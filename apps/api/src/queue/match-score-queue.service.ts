import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

import { MATCH_SCORE_QUEUE } from "./queue.constants";

export interface MatchScorePayload {
  applicationId: string;
  candidateId: string;
  jobId: string;
  resumeId: string;
}

/**
 * Thin enqueue facade for the match-score worker. Lives in the global
 * QueueModule so feature modules (applications, scoring) can inject it
 * without circular dependencies. Failures never propagate - the application
 * row already exists in 'computing' state, so an orphaned job will be
 * caught by the future rescore-orphans cron.
 */
@Injectable()
export class MatchScoreQueueService {
  private readonly logger = new Logger(MatchScoreQueueService.name);

  constructor(
    @InjectQueue(MATCH_SCORE_QUEUE)
    private readonly queue: Queue<MatchScorePayload>,
  ) {}

  async enqueue(payload: MatchScorePayload): Promise<void> {
    try {
      const job = await this.queue.add("score", payload, {
        jobId: `score__${payload.applicationId}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 7 * 86_400 },
      });
      this.logger.log(
        `Enqueued match-score job ${job.id} for application=${payload.applicationId}`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to enqueue match-score: ${(err as Error).message}`,
      );
    }
  }
}
