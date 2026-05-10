import { Inject, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { and, desc, eq, notInArray } from "drizzle-orm";
import {
  applicationsTable,
  jobsTable,
  matchScorePreviewsTable,
} from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../../db/db.module";
import {
  MATCH_PREVIEW_PRECOMPUTE_QUEUE,
  MATCH_PREVIEW_TOP_N,
} from "../../../queue/queue.constants";
import type { MatchPreviewPrecomputePayload } from "../../../queue/match-preview-queue.service";
import { ScoringService } from "../scoring.service";

export interface MatchPreviewPrecomputeResult {
  picked: number;
  computed: number;
  skipped: number;
  failed: number;
  durationMs: number;
}

/**
 * Auto-computes match-score previews for the candidate's top-N candidate-
 * visible jobs immediately after their resume is parsed.
 *
 * Selection: published jobs the candidate hasn't applied to and doesn't
 * already have a preview for under this resume — ordered by recency.
 *
 * Boundaries:
 *   * Sequential per job (concurrency: 1) so we never burst the OpenAI
 *     account with N parallel calls per resume parse.
 *   * Existing previews for the same (candidate, job, resume) triple are
 *     skipped — re-running this job is idempotent.
 *   * Failures of one job don't fail the whole batch — they're logged and
 *     counted in the result.
 */
@Processor(MATCH_PREVIEW_PRECOMPUTE_QUEUE, { concurrency: 1 })
export class MatchPreviewPrecomputeProcessor extends WorkerHost {
  private readonly logger = new Logger(MatchPreviewPrecomputeProcessor.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly scoring: ScoringService,
  ) {
    super();
  }

  async process(
    job: Job<MatchPreviewPrecomputePayload>,
  ): Promise<MatchPreviewPrecomputeResult> {
    const startedAt = Date.now();
    const { candidateId, resumeId } = job.data;
    this.logger.log(
      `[job ${job.id}] precomputing top-${MATCH_PREVIEW_TOP_N} previews for candidate=${candidateId} resume=${resumeId}`,
    );

    // Jobs the candidate has already applied to — skip.
    const appliedRows = await this.db
      .select({ jobId: applicationsTable.jobId })
      .from(applicationsTable)
      .where(eq(applicationsTable.candidateId, candidateId));
    const appliedJobIds = appliedRows.map((r) => r.jobId);

    // Top published jobs not already applied to. We grab MATCH_PREVIEW_TOP_N
    // rows and skip any that already have a fresh preview for this resume.
    const candidates = await this.db
      .select({ id: jobsTable.id })
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.status, "published"),
          appliedJobIds.length > 0
            ? notInArray(jobsTable.id, appliedJobIds)
            : undefined,
        ),
      )
      .orderBy(desc(jobsTable.publishedAt), desc(jobsTable.createdAt))
      .limit(MATCH_PREVIEW_TOP_N);

    let computed = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < candidates.length; i++) {
      const { id: jobId } = candidates[i]!;

      try {
        const existing = await this.db
          .select({ id: matchScorePreviewsTable.id })
          .from(matchScorePreviewsTable)
          .where(
            and(
              eq(matchScorePreviewsTable.candidateId, candidateId),
              eq(matchScorePreviewsTable.jobId, jobId),
              eq(matchScorePreviewsTable.resumeId, resumeId),
            ),
          )
          .limit(1);
        if (existing.length > 0) {
          skipped++;
          continue;
        }

        await this.scoring.computeMatchPreview(
          { id: candidateId, role: "candidate" } as Parameters<
            ScoringService["computeMatchPreview"]
          >[0],
          jobId,
          { source: "system" },
        );
        computed++;
      } catch (err) {
        const message = (err as Error).message ?? "unknown";
        this.logger.warn(
          `[job ${job.id}] preview compute failed for job ${jobId}: ${message}`,
        );
        failed++;
      }

      await job.updateProgress(Math.round(((i + 1) / candidates.length) * 100));
    }

    const durationMs = Date.now() - startedAt;
    this.logger.log(
      `[job ${job.id}] complete: picked=${candidates.length} computed=${computed} skipped=${skipped} failed=${failed} in ${durationMs}ms`,
    );

    return {
      picked: candidates.length,
      computed,
      skipped,
      failed,
      durationMs,
    };
  }
}
