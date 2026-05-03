import { Inject, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { desc, eq } from "drizzle-orm";
import {
  applicationsTable,
  jobsTable,
  matchScoresTable,
  resumesTable,
} from "@aurahire/db";
import type { ParsedResume } from "@aurahire/shared";

import { ScoreMatchService } from "../../../ai/score-match.service";
import { ScoringRepository } from "../../scoring/scoring.repository";
import { AuditService } from "../../../audit";
import { AUDIT_ACTIONS } from "../../../audit/audit.types";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../../../db/db.module";
import { RESCORE_BATCH_QUEUE } from "../../../queue/queue.constants";

export interface RescoreBatchPayload {
  sampleSize: number;
  enqueuedBy: string;
  enqueuedAt: string;
}

export interface RescoreBatchResult {
  processedCount: number;
  skippedCount: number;
  failedCount: number;
  durationMs: number;
}

@Processor(RESCORE_BATCH_QUEUE, { concurrency: 1 })
export class RescoreBatchProcessor extends WorkerHost {
  private readonly logger = new Logger(RescoreBatchProcessor.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly scoreMatch: ScoreMatchService,
    private readonly scoringRepo: ScoringRepository,
    private readonly audit: AuditService,
  ) {
    super();
  }

  async process(job: Job<RescoreBatchPayload>): Promise<RescoreBatchResult> {
    const startedAt = Date.now();
    const { sampleSize, enqueuedBy } = job.data;
    this.logger.log(`[job ${job.id}] starting rescore-batch sampleSize=${sampleSize}`);

    const config = await this.scoringRepo.getActiveConfig();
    if (!config) {
      this.logger.error(`[job ${job.id}] no active scoring config; aborting`);
      throw new Error("No active scoring config");
    }
    const weights = config.matchWeights as {
      skills: number;
      experience: number;
      education: number;
      cultural_fit: number;
    };

    const rows = await this.db
      .select({
        application: applicationsTable,
        resume: resumesTable,
        job: jobsTable,
      })
      .from(applicationsTable)
      .innerJoin(resumesTable, eq(resumesTable.id, applicationsTable.resumeId))
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .orderBy(desc(applicationsTable.appliedAt))
      .limit(sampleSize);

    let processedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const { application, resume, job: jobRow } = row;

      try {
        if (resume.parseStatus !== "parsed" || !resume.parsedData) {
          this.logger.warn(`[job ${job.id}] skipping app ${application.id}: resume not parsed`);
          skippedCount++;
          continue;
        }

        if (jobRow.status === "archived") {
          this.logger.warn(`[job ${job.id}] skipping app ${application.id}: job archived`);
          skippedCount++;
          continue;
        }

        const [previousScore] = await this.db
          .select()
          .from(matchScoresTable)
          .where(eq(matchScoresTable.applicationId, application.id))
          .orderBy(desc(matchScoresTable.createdAt))
          .limit(1);

        const aiResult = await this.scoreMatch.score({
          parsedResume: resume.parsedData as unknown as ParsedResume,
          job: {
            title: jobRow.title,
            department: jobRow.department,
            experienceLevel: jobRow.experienceLevel,
            educationRequirement: jobRow.educationRequirement,
            requiredSkills: jobRow.requiredSkills,
            descriptionPlain: jobRow.descriptionPlain,
          },
          weights,
          requestId: `rescore-batch:${job.id}:${application.id}`,
        });

        const evidenceRows = aiResult.score.components.flatMap((comp) =>
          comp.evidence.map((ev) => ({
            componentName: comp.name,
            excerptText: ev.excerpt,
            excerptSource: ev.source,
            relevance: ev.relevance,
            contributionPoints: ev.contribution_points,
          })),
        );

        const { matchScore } = await this.scoringRepo.insertMatchScore(
          {
            applicationId: application.id,
            candidateId: application.candidateId,
            jobId: application.jobId,
            resumeId: application.resumeId,
            overallScore: aiResult.score.overall_score,
            band: aiResult.score.band,
            components: aiResult.score.components as unknown as Record<string, unknown>,
            redactedFields: aiResult.redactedFields,
            weightsUsed: weights as unknown as Record<string, unknown>,
            promptVersion: aiResult.promptVersion,
            modelUsed: aiResult.model,
            rawOutput: aiResult.score as unknown as Record<string, unknown>,
            latencyMs: aiResult.latencyMs,
            status: "completed",
          },
          evidenceRows,
        );

        await this.audit.log({
          actorId: enqueuedBy,
          actorType: "system",
          action: AUDIT_ACTIONS.SCORE_MATCH_RECOMPUTED,
          entityType: "match_score",
          entityId: matchScore.id,
          details: {
            applicationId: application.id,
            jobId: application.jobId,
            queueJobId: job.id,
            before: previousScore
              ? {
                  matchScoreId: previousScore.id,
                  overallScore: previousScore.overallScore,
                  band: previousScore.band,
                  weightsUsed: previousScore.weightsUsed,
                }
              : null,
            after: {
              matchScoreId: matchScore.id,
              overallScore: matchScore.overallScore,
              band: matchScore.band,
              weightsUsed: weights,
            },
          },
        });

        processedCount++;
      } catch (err) {
        this.logger.error(
          `[job ${job.id}] app ${application.id} failed: ${(err as Error).message}`,
        );
        failedCount++;
      }

      await job.updateProgress(Math.round(((i + 1) / rows.length) * 100));
    }

    const durationMs = Date.now() - startedAt;
    this.logger.log(
      `[job ${job.id}] complete: ${processedCount} processed, ${skippedCount} skipped, ${failedCount} failed in ${durationMs}ms`,
    );

    return { processedCount, skippedCount, failedCount, durationMs };
  }
}
