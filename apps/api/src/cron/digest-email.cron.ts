import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";

import { NotificationsRepository } from "../modules/notifications/notifications.repository";
import {
  NOTIFICATION_EMAIL_QUEUE,
  type NotificationEmailJobData,
} from "../modules/notifications/queues";
import { AUDIT_ACTIONS, AuditService } from "../audit";

const CRON_NAME = "digest-email";
// audit_logs.entity_id is NOT NULL UUID; sentinel for cron-level entries.
const CRON_ENTITY_SENTINEL = "00000000-0000-0000-0000-000000000000";

@Injectable()
export class DigestEmailCron {
  private readonly logger = new Logger(DigestEmailCron.name);

  constructor(
    private readonly repo: NotificationsRepository,
    @InjectQueue(NOTIFICATION_EMAIL_QUEUE)
    private readonly queue: Queue<NotificationEmailJobData>,
    private readonly audit: AuditService,
  ) {}

  /** Daily at 08:00 Asia/Manila. */
  @Cron("0 8 * * *", { name: CRON_NAME, timeZone: "Asia/Manila" })
  async run(): Promise<{ userCount: number; notificationCount: number; durationMs: number }> {
    return this.execute();
  }

  /** Public for the dev-only debug endpoint to invoke manually. */
  async execute(): Promise<{ userCount: number; notificationCount: number; durationMs: number }> {
    const startedAt = Date.now();
    const batches = await this.repo.findDigestPendingByUser();
    let totalNotifications = 0;

    for (const batch of batches) {
      try {
        await this.queue.add(
          "digest-email",
          { kind: "digest", userId: batch.userId, notificationIds: batch.ids },
          { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
        );
        await this.repo.clearDigestPending(batch.ids);
        totalNotifications += batch.ids.length;
      } catch (err) {
        this.logger.error(
          `[${CRON_NAME}] enqueue failed for user ${batch.userId}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }

    const durationMs = Date.now() - startedAt;
    await this.audit.log({
      actorId: null,
      actorType: "system",
      action: AUDIT_ACTIONS.DIGEST_EMAIL_BATCH_RUN,
      entityType: "cron",
      entityId: CRON_ENTITY_SENTINEL,
      details: { userCount: batches.length, notificationCount: totalNotifications, durationMs },
    });
    this.logger.log(
      `[${CRON_NAME}] enqueued ${batches.length} user batches / ${totalNotifications} notifications in ${durationMs}ms`,
    );
    return { userCount: batches.length, notificationCount: totalNotifications, durationMs };
  }
}
