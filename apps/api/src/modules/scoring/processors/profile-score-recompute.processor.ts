import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";

import { PROFILE_SCORE_RECOMPUTE_QUEUE } from "../../../queue/queue.constants";
import type { ProfileScoreRecomputePayload } from "../../../queue/profile-score-queue.service";
import { ScoringService } from "../scoring.service";

/**
 * Drains the `profile-score-recompute` queue (enqueued by
 * ProfileScoreQueueService when a candidate's resume / preferences /
 * profile change). Each job triggers a fresh AI run via
 * ScoringService.computeProfileScore — which writes a new profile_scores
 * row, an audit_logs entry tagged with the recompute reason, and busts
 * the candidate's cached score.
 *
 * Concurrency 3 matches the match-score processor: parallel enough to
 * drain bursts after a wave of profile edits, conservative enough that
 * we don't burst the OpenAI account when many candidates edit at once.
 *
 * Errors propagate so BullMQ honours the queue's retry config — we never
 * swallow + log silently here, otherwise a transient OpenAI 5xx would
 * permanently leave a candidate's score stale. The realtime emit on
 * success is added in Phase 2 / Task 25.
 */
@Processor(PROFILE_SCORE_RECOMPUTE_QUEUE, { concurrency: 3 })
export class ProfileScoreRecomputeProcessor extends WorkerHost {
  private readonly logger = new Logger(ProfileScoreRecomputeProcessor.name);

  constructor(private readonly scoring: ScoringService) {
    super();
  }

  async process(job: Job<ProfileScoreRecomputePayload>): Promise<void> {
    const { candidateId, resumeId, reason } = job.data;
    const startedAt = Date.now();
    this.logger.log(
      `[recompute ${job.id}] candidate=${candidateId} resume=${resumeId} reason=${reason}`,
    );

    try {
      const dto = await this.scoring.computeProfileScore(candidateId, resumeId, {
        reason,
      });
      this.logger.log(
        `[recompute ${job.id}] ok in ${Date.now() - startedAt}ms — ${dto.overallScore}/100 ${dto.band}`,
      );
    } catch (err) {
      this.logger.error(
        `[recompute ${job.id}] failed for candidate=${candidateId} reason=${reason}: ${(err as Error).message}`,
      );
      // Re-throw so BullMQ honours the retry config configured at enqueue
      // (see ProfileScoreQueueService). Swallowing here would leave a
      // candidate's score stale on every transient AI failure.
      throw err;
    }
  }
}
