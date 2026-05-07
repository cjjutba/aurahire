import { ConfigService } from "@nestjs/config";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { and, eq, gte, lte, isNull, isNotNull } from "drizzle-orm";
import {
  offersTable,
  applicationsTable,
  jobsTable,
  companiesTable,
} from "@aurahire/db";

import { AUDIT_ACTIONS, AuditService } from "../audit";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../db/db.module";
import { NotificationsService } from "../modules/notifications/notifications.service";

const CRON_NAME = "offer-expiry-reminder";
const CRON_ENTITY_SENTINEL = "00000000-0000-0000-0000-000000000000";
const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class OfferExpiryReminderCron {
  private readonly logger = new Logger(OfferExpiryReminderCron.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  /** Hourly at minute 0. */
  @Cron("0 * * * *", { name: CRON_NAME, timeZone: "Asia/Manila" })
  async run(): Promise<{ remindersSent: number; durationMs: number }> {
    return this.execute();
  }

  /** Public for the dev-only debug endpoint. */
  async execute(): Promise<{ remindersSent: number; durationMs: number }> {
    const startedAt = Date.now();
    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);

    const due = await this.db
      .select({
        offerId: offersTable.id,
        applicationId: offersTable.applicationId,
        expiresAt: offersTable.expiresAt,
        candidateId: applicationsTable.candidateId,
        jobTitle: jobsTable.title,
        companyName: companiesTable.name,
      })
      .from(offersTable)
      .innerJoin(applicationsTable, eq(applicationsTable.id, offersTable.applicationId))
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .innerJoin(companiesTable, eq(companiesTable.id, jobsTable.companyId))
      .where(
        and(
          isNotNull(offersTable.expiresAt),
          gte(offersTable.expiresAt, now),
          lte(offersTable.expiresAt, windowEnd),
          isNull(offersTable.expiryReminderSentAt),
          eq(offersTable.status, "pending"),
        ),
      )
      .limit(200);

    let sent = 0;
    for (const row of due) {
      try {
        await this.notifications.emit({
          userId: row.candidateId,
          eventType: "offer_expiring_soon",
          entityType: "offer",
          entityId: row.offerId,
          metadata: {
            offerId: row.offerId,
            applicationId: row.applicationId,
            jobTitle: row.jobTitle,
            companyName: row.companyName,
            expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
          },
        });
        await this.db
          .update(offersTable)
          .set({ expiryReminderSentAt: new Date() })
          .where(eq(offersTable.id, row.offerId));
        sent += 1;
      } catch (err) {
        this.logger.error(
          `[${CRON_NAME}] reminder emit failed for offer ${row.offerId}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }

    const durationMs = Date.now() - startedAt;
    await this.audit.log({
      actorId: null,
      actorType: "system",
      action: AUDIT_ACTIONS.OFFER_EXPIRY_REMINDER_RUN,
      entityType: "cron",
      entityId: CRON_ENTITY_SENTINEL,
      details: { remindersSent: sent, candidatesScanned: due.length, durationMs },
    });
    this.logger.log(`[${CRON_NAME}] sent ${sent}/${due.length} reminders in ${durationMs}ms`);
    return { remindersSent: sent, durationMs };
  }
}
