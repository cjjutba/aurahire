import { Inject, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { applicationsTable, jobsTable } from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../../db/db.module";
import { EventsService } from "../../../realtime";
import { MATCH_SCORE_QUEUE } from "../../../queue/queue.constants";
import type { MatchScorePayload } from "../../../queue/match-score-queue.service";
import { ScoringService } from "../scoring.service";

/**
 * Async match-scoring worker. Triggered by ApplicationsService.apply()
 * via MatchScoreQueueService. On success persists the score row,
 * flips applications.score_status to 'completed', and broadcasts
 * application.scored to user/recruiter/job rooms. On terminal failure
 * (after attempts exhausted) flips score_status to 'failed' so the UI
 * can surface a manual retry affordance.
 *
 * Concurrency 3 keeps the OpenAI call rate predictable; backoff is
 * configured at the enqueue site (3 attempts, exponential 5s base).
 */
@Processor(MATCH_SCORE_QUEUE, { concurrency: 3 })
export class MatchScoreProcessor extends WorkerHost {
  private readonly logger = new Logger(MatchScoreProcessor.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly scoring: ScoringService,
    private readonly events: EventsService,
  ) {
    super();
  }

  async process(job: Job<MatchScorePayload>): Promise<void> {
    const { applicationId, candidateId, jobId, resumeId } = job.data;
    const startedAt = Date.now();

    const [jobRow] = await this.db
      .select({
        title: jobsTable.title,
        department: jobsTable.department,
        experienceLevel: jobsTable.experienceLevel,
        educationRequirement: jobsTable.educationRequirement,
        requiredSkills: jobsTable.requiredSkills,
        descriptionPlain: jobsTable.descriptionPlain,
        companyId: jobsTable.companyId,
        recruiterId: jobsTable.recruiterId,
      })
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);

    if (!jobRow) {
      this.logger.warn(
        `[score-job ${job.id}] job ${jobId} no longer exists; marking failed`,
      );
      await this.markFailed(applicationId);
      return;
    }

    let dto;
    try {
      dto = await this.scoring.computeMatchScore(
        applicationId,
        candidateId,
        jobId,
        resumeId,
        {
          title: jobRow.title,
          department: jobRow.department,
          experienceLevel: jobRow.experienceLevel,
          educationRequirement: jobRow.educationRequirement,
          requiredSkills: jobRow.requiredSkills,
          descriptionPlain: jobRow.descriptionPlain,
          companyId: jobRow.companyId,
        },
      );
    } catch (err) {
      const attemptsMade = job.attemptsMade + 1;
      const attemptsTotal = job.opts.attempts ?? 1;
      this.logger.warn(
        `[score-job ${job.id}] attempt ${attemptsMade}/${attemptsTotal} failed: ${(err as Error).message}`,
      );
      if (attemptsMade >= attemptsTotal) {
        await this.markFailed(applicationId);
      }
      throw err;
    }

    await this.db
      .update(applicationsTable)
      .set({ scoreStatus: "completed", updatedAt: new Date() })
      .where(eq(applicationsTable.id, applicationId));

    this.events.emitApplicationScored({
      applicationId,
      jobId,
      recruiterId: jobRow.recruiterId,
      candidateId,
      overallScore: dto.overallScore,
      band: dto.band,
      scoredAt: new Date().toISOString(),
    });

    this.logger.log(
      `[score-job ${job.id}] ok in ${Date.now() - startedAt}ms — ${dto.overallScore}/100 ${dto.band}`,
    );
  }

  private async markFailed(applicationId: string): Promise<void> {
    await this.db
      .update(applicationsTable)
      .set({ scoreStatus: "failed", updatedAt: new Date() })
      .where(eq(applicationsTable.id, applicationId));
  }
}
