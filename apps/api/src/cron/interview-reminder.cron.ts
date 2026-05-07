import { ConfigService } from "@nestjs/config";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { and, eq, gte, lte, isNull } from "drizzle-orm";
import {
  interviewsTable,
  applicationsTable,
  jobsTable,
  companiesTable,
} from "@aurahire/db";

import { AUDIT_ACTIONS, AuditService } from "../audit";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../db/db.module";
import { NotificationsService } from "../modules/notifications/notifications.service";

const CRON_NAME = "interview-reminder";
// audit_logs.entity_id is NOT NULL UUID; sentinel for cron-level entries.
const CRON_ENTITY_SENTINEL = "00000000-0000-0000-0000-000000000000";
const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class InterviewReminderCron {
  private readonly logger = new Logger(InterviewReminderCron.name);

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

  /** Public for the dev-only debug endpoint to invoke manually. */
  async execute(): Promise<{ remindersSent: number; durationMs: number }> {
    const startedAt = Date.now();
    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);

    const due = await this.db
      .select({
        interviewId: interviewsTable.id,
        applicationId: interviewsTable.applicationId,
        scheduledAt: interviewsTable.scheduledAt,
        format: interviewsTable.format,
        candidateId: applicationsTable.candidateId,
        jobTitle: jobsTable.title,
        companyName: companiesTable.name,
      })
      .from(interviewsTable)
      .innerJoin(applicationsTable, eq(applicationsTable.id, interviewsTable.applicationId))
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .innerJoin(companiesTable, eq(companiesTable.id, jobsTable.companyId))
      .where(
        and(
          gte(interviewsTable.scheduledAt, now),
          lte(interviewsTable.scheduledAt, windowEnd),
          isNull(interviewsTable.reminderSentAt),
          eq(interviewsTable.status, "scheduled"),
        ),
      )
      .limit(200);

    let sent = 0;
    for (const row of due) {
      try {
        await this.notifications.emit({
          userId: row.candidateId,
          eventType: "interview_reminder_24h",
          entityType: "interview",
          entityId: row.interviewId,
          metadata: {
            interviewId: row.interviewId,
            applicationId: row.applicationId,
            jobTitle: row.jobTitle,
            companyName: row.companyName,
            startTime: row.scheduledAt.toISOString(),
            format: row.format,
          },
        });
        await this.db
          .update(interviewsTable)
          .set({ reminderSentAt: new Date() })
          .where(eq(interviewsTable.id, row.interviewId));
        sent += 1;
      } catch (err) {
        this.logger.error(
          `[${CRON_NAME}] reminder emit failed for interview ${row.interviewId}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }

    const durationMs = Date.now() - startedAt;
    await this.audit.log({
      actorId: null,
      actorType: "system",
      action: AUDIT_ACTIONS.INTERVIEW_REMINDER_RUN,
      entityType: "cron",
      entityId: CRON_ENTITY_SENTINEL,
      details: { remindersSent: sent, candidatesScanned: due.length, durationMs },
    });
    this.logger.log(`[${CRON_NAME}] sent ${sent}/${due.length} reminders in ${durationMs}ms`);
    return { remindersSent: sent, durationMs };
  }
}
