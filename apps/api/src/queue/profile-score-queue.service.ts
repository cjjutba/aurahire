import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

import { PROFILE_SCORE_RECOMPUTE_QUEUE } from "./queue.constants";

/**
 * Reasons a Profile Score recompute can be triggered. Forwarded to the
 * processor (Task 9) for audit / observability.
 */
export type ProfileScoreRecomputeReason =
  | "resume_change"
  | "preferences_change"
  | "profile_change"
  | "manual_recompute"
  | "onboarding";

export interface ProfileScoreRecomputePayload {
  candidateId: string;
  resumeId: string;
  reason: ProfileScoreRecomputeReason;
}

export interface ProfileScoreEnqueueOptions {
  /**
   * Override the BullMQ jobId used for dedupe. Defaults to the
   * `recompute__<candidate>__<resume>__<reason>` shape so duplicate
   * enqueues within a UI flow collapse. Pass a stable value (e.g.
   * backfill keyed on candidate+resume only) when you want a wider dedupe
   * window. `__` (double underscore) is used in place of `:` because
   * BullMQ rejects custom ids that contain a colon unless the id splits
   * into exactly three parts - a fragile constraint, so we avoid the
   * separator entirely.
   */
  jobId?: string;
}

/**
 * Thin enqueue facade for the profile-score-recompute worker. Lives in the
 * global QueueModule so any feature module can inject it without pulling
 * scoring's whole dependency graph in. The processor itself is added in
 * Task 9 (scoring module) and consumes the same queue name.
 */
@Injectable()
export class ProfileScoreQueueService {
  private readonly logger = new Logger(ProfileScoreQueueService.name);

  constructor(
    @InjectQueue(PROFILE_SCORE_RECOMPUTE_QUEUE)
    private readonly queue: Queue<ProfileScoreRecomputePayload>,
  ) {}

  /**
   * Enqueue a profile-score recompute. Idempotent on (candidate, resume,
   * reason): a duplicate within a short window is collapsed by jobId so we
   * don't burn OpenAI calls when several inputs flip in the same UI flow.
   *
   * Pass `options.jobId` to override the dedupe key - used by the
   * portal-entry backfill guard (Task 12) which wants a candidate+resume
   * dedupe so repeat dashboard hits don't enqueue parallel backfills.
   */
  async enqueueRecompute(
    payload: ProfileScoreRecomputePayload,
    options: ProfileScoreEnqueueOptions = {},
  ): Promise<void> {
    try {
      const jobId =
        options.jobId ??
        `recompute__${payload.candidateId}__${payload.resumeId}__${payload.reason}`;
      const job = await this.queue.add("recompute", payload, {
        jobId,
        attempts: 1,
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 7 * 86400 },
      });
      this.logger.log(
        `Enqueued profile-score recompute job ${job.id} for candidate=${payload.candidateId} resume=${payload.resumeId} reason=${payload.reason}`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to enqueue profile-score recompute: ${(err as Error).message}`,
      );
    }
  }
}
