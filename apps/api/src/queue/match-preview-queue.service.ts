import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { JobType, Queue } from "bullmq";

import { MATCH_PREVIEW_PRECOMPUTE_QUEUE } from "./queue.constants";

export interface MatchPreviewPrecomputePayload {
  candidateId: string;
  resumeId: string;
}

/** States a precompute job can be in that we want to cancel on resume swap. */
const CANCELLABLE_STATES: JobType[] = [
  "waiting",
  "active",
  "delayed",
  "paused",
];

const CANCEL_SCAN_BATCH = 200;

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
   *
   * Returns the BullMQ job id (for callers that need to surface it in a
   * synchronous response — e.g. the onboarding-completion handshake), or
   * `null` when enqueue fails or the queue declines to assign an id.
   */
  async enqueuePrecompute(
    payload: MatchPreviewPrecomputePayload,
  ): Promise<string | null> {
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
      return job.id ?? null;
    } catch (err) {
      this.logger.warn(
        `Failed to enqueue match-preview precompute: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Cancel any in-flight precompute jobs scoped to a specific resume id.
   * Called when the candidate's default resume changes — work scheduled
   * against the OLD resume is now wasted because the on-screen feed will
   * be driven by previews against the NEW resume.
   *
   * BullMQ doesn't support querying by job-data fields, so we iterate the
   * cancellable states and filter in-process. Each state is fetched in one
   * batch (CANCEL_SCAN_BATCH); the queue should not realistically exceed
   * this depth in normal operation, but we log if we hit the cap so an
   * operator notices.
   */
  async cancelByResumeId(resumeId: string): Promise<number> {
    let cancelled = 0;
    for (const state of CANCELLABLE_STATES) {
      const jobs = await this.queue.getJobs([state], 0, CANCEL_SCAN_BATCH - 1);
      if (jobs.length === CANCEL_SCAN_BATCH) {
        this.logger.warn(
          `cancelByResumeId hit scan cap (${CANCEL_SCAN_BATCH}) in state=${state}; some jobs may not have been considered`,
        );
      }
      for (const job of jobs) {
        if (job.data?.resumeId === resumeId) {
          try {
            await job.remove();
            cancelled++;
          } catch (err) {
            // BullMQ's remove() can race with the worker locking the job —
            // failures here are non-fatal; the worker may have already
            // started processing it.
            this.logger.warn(
              `Failed to cancel job ${job.id} for resume ${resumeId}: ${(err as Error).message}`,
            );
          }
        }
      }
    }
    if (cancelled > 0) {
      this.logger.log(
        `Cancelled ${cancelled} in-flight precompute job(s) for resume=${resumeId}`,
      );
    }
    return cancelled;
  }
}
