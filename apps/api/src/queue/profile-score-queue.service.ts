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
   */
  async enqueueRecompute(payload: ProfileScoreRecomputePayload): Promise<void> {
    try {
      const job = await this.queue.add("recompute", payload, {
        jobId: `recompute:${payload.candidateId}:${payload.resumeId}:${payload.reason}`,
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
