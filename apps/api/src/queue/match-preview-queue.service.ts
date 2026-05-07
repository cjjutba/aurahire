import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

import { MATCH_PREVIEW_PRECOMPUTE_QUEUE } from "./queue.constants";

export interface MatchPreviewPrecomputePayload {
  candidateId: string;
  resumeId: string;
}

/**
 * Thin enqueue facade for the match-preview-precompute worker. Lives in
 * the global QueueModule (not scoring) so any feature module can inject it
 * without introducing a circular dependency back into scoring. The actual
 * processor still lives in the scoring module (which owns the work).
 */
@Injectable()
export class MatchPreviewQueueService {
  private readonly logger = new Logger(MatchPreviewQueueService.name);

  constructor(
    @InjectQueue(MATCH_PREVIEW_PRECOMPUTE_QUEUE)
    private readonly queue: Queue<MatchPreviewPrecomputePayload>,
  ) {}

  /**
   * Enqueue a precompute pass for (candidate, resume). Idempotent on the
   * queue side because the worker UPSERTs and skips existing previews —
   * duplicate enqueues at most cost a few cheap reads. Failures are
   * non-fatal: the candidate's resume parse already succeeded; the
   * auto-preview is best-effort.
   */
  async enqueuePrecompute(payload: MatchPreviewPrecomputePayload): Promise<void> {
    try {
      const job = await this.queue.add("precompute", payload, {
        jobId: `precompute:${payload.candidateId}:${payload.resumeId}`,
        attempts: 1,
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 7 * 86400 },
      });
      this.logger.log(
        `Enqueued match-preview precompute job ${job.id} for candidate=${payload.candidateId} resume=${payload.resumeId}`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to enqueue match-preview precompute: ${(err as Error).message}`,
      );
    }
  }
}
