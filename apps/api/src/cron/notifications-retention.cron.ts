import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { NotificationsRepository } from "../modules/notifications/notifications.repository";
import { AUDIT_ACTIONS, AuditService } from "../audit";

const CRON_NAME = "notifications-retention";
const CRON_ENTITY_SENTINEL = "00000000-0000-0000-0000-000000000000";
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

@Injectable()
export class NotificationsRetentionCron {
  private readonly logger = new Logger(NotificationsRetentionCron.name);

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly audit: AuditService,
  ) {}

  /** Daily at 03:00 Asia/Manila. */
  @Cron("0 3 * * *", { name: CRON_NAME, timeZone: "Asia/Manila" })
  async run(): Promise<{ deleted: number; durationMs: number }> {
    return this.execute();
  }

  /** Public for the dev-only debug endpoint to invoke manually. */
  async execute(): Promise<{ deleted: number; durationMs: number }> {
    const startedAt = Date.now();
    const cutoff = new Date(Date.now() - NINETY_DAYS_MS);
    const deleted = await this.repo.deleteOlderThan(cutoff);
    const durationMs = Date.now() - startedAt;

    await this.audit.log({
      actorId: null,
      actorType: "system",
      action: AUDIT_ACTIONS.NOTIFICATIONS_RETENTION_RUN,
      entityType: "cron",
      entityId: CRON_ENTITY_SENTINEL,
      details: { deleted, cutoffIso: cutoff.toISOString(), durationMs },
    });
    this.logger.log(
      `[${CRON_NAME}] deleted ${deleted} rows older than ${cutoff.toISOString()} in ${durationMs}ms`,
    );
    return { deleted, durationMs };
  }
}
