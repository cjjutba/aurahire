import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import type { AuthUser, EnqueueRescoreBatchInput } from "@aurahire/shared";

import { AuditService } from "../../../audit";
import { AUDIT_ACTIONS } from "../../../audit/audit.types";
import { RESCORE_BATCH_QUEUE } from "../../../queue/queue.constants";
import type {
  RescoreBatchPayload,
  RescoreBatchResult,
} from "../processors/rescore-batch.processor";
import type {
  EnqueueRescoreBatchResponseDto,
  QueueJobStatusDataDto,
} from "../dto/queue-job-status-response.dto";

type QueueJobState = QueueJobStatusDataDto["state"];

@Injectable()
export class AdminQueueService {
  private readonly logger = new Logger(AdminQueueService.name);

  constructor(
    @InjectQueue(RESCORE_BATCH_QUEUE)
    private readonly rescoreQueue: Queue<
      RescoreBatchPayload,
      RescoreBatchResult
    >,
    private readonly audit: AuditService,
  ) {}

  async enqueueRescoreBatch(
    actor: AuthUser,
    dto: EnqueueRescoreBatchInput,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<EnqueueRescoreBatchResponseDto["data"]> {
    const enqueuedAt = new Date().toISOString();

    const job = await this.rescoreQueue.add("rescore-batch", {
      sampleSize: dto.sampleSize,
      enqueuedBy: actor.id,
      enqueuedAt,
    });

    if (!job.id) {
      throw new Error("BullMQ returned no job id");
    }

    await this.audit.log({
      actorId: actor.id,
      actorType: "user",
      action: AUDIT_ACTIONS.QUEUE_RESCORE_BATCH_ENQUEUED,
      entityType: "queue_job",
      entityId: job.id,
      details: {
        queueName: RESCORE_BATCH_QUEUE,
        sampleSize: dto.sampleSize,
      },
      ...requestMeta,
    });

    this.logger.log(
      `Enqueued rescore-batch job ${job.id} (sampleSize=${dto.sampleSize})`,
    );

    return {
      queueJobId: job.id,
      queueName: RESCORE_BATCH_QUEUE,
      sampleSize: dto.sampleSize,
      enqueuedAt,
    };
  }

  async getJobStatus(queueJobId: string): Promise<QueueJobStatusDataDto> {
    const job = await this.rescoreQueue.getJob(queueJobId);

    if (!job) {
      return {
        queueJobId,
        state: "unknown",
        progress: 0,
        processedOn: null,
        finishedOn: null,
        result: null,
        failedReason: null,
      };
    }

    const state = (await job.getState()) as QueueJobState;
    const progress = typeof job.progress === "number" ? job.progress : 0;

    return {
      queueJobId,
      state,
      progress,
      processedOn: job.processedOn
        ? new Date(job.processedOn).toISOString()
        : null,
      finishedOn: job.finishedOn
        ? new Date(job.finishedOn).toISOString()
        : null,
      result:
        state === "completed"
          ? ((job.returnvalue as RescoreBatchResult | undefined) ?? null)
          : null,
      failedReason: state === "failed" ? (job.failedReason ?? null) : null,
    };
  }
}
