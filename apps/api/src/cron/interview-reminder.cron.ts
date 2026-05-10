import { ConfigService } from "@nestjs/config";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { and, eq, gte, lte, isNull } from "drizzle-orm";
import {
  interviewsTable,
  applicationsTable,
  jobsTable,
  companiesTable,
  profilesTable,
} from "@aurahire/db";

import { AUDIT_ACTIONS, AuditService } from "../audit";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../db/db.module";
import { EmailService } from "../email/email.service";
import { InterviewReminderEmail } from "../email/templates/interview-reminder";
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
    private readonly email: EmailService,
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
        durationMinutes: interviewsTable.durationMinutes,
        format: interviewsTable.format,
        venueName: interviewsTable.venueName,
        addressLine: interviewsTable.addressLine,
        roomOrFloor: interviewsTable.roomOrFloor,
        reportingInstructions: interviewsTable.reportingInstructions,
        whatToBring: interviewsTable.whatToBring,
        interviewerName: interviewsTable.interviewerName,
        interviewerTitle: interviewsTable.interviewerTitle,
        mapUrl: interviewsTable.mapUrl,
        candidateId: applicationsTable.candidateId,
        candidateEmail: profilesTable.email,
        candidateName: profilesTable.fullName,
        jobTitle: jobsTable.title,
        companyName: companiesTable.name,
        companyLogoUrl: companiesTable.logoUrl,
      })
      .from(interviewsTable)
      .innerJoin(
        applicationsTable,
        eq(applicationsTable.id, interviewsTable.applicationId),
      )
      .innerJoin(
        profilesTable,
        eq(profilesTable.id, applicationsTable.candidateId),
      )
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

    const appUrl =
      this.config.get<string>("APP_URL") ?? "http://localhost:3000";

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
            venueName: row.venueName ?? null,
            addressLine: row.addressLine ?? null,
            roomOrFloor: row.roomOrFloor ?? null,
            reportingInstructions: row.reportingInstructions ?? null,
            whatToBring: row.whatToBring ?? null,
            interviewerName: row.interviewerName ?? null,
            interviewerTitle: row.interviewerTitle ?? null,
            mapUrl: row.mapUrl ?? null,
          },
        });

        // Rich email reminder with full venue details.
        await this.email.send({
          to: row.candidateEmail,
          subject: `Reminder: your interview for ${row.jobTitle} is tomorrow`,
          template: InterviewReminderEmail({
            candidateName: row.candidateName,
            jobTitle: row.jobTitle,
            companyName: row.companyName,
            scheduledAt: row.scheduledAt.toISOString(),
            durationMinutes: row.durationMinutes,
            format: row.format,
            venueName: row.venueName ?? null,
            addressLine: row.addressLine ?? null,
            roomOrFloor: row.roomOrFloor ?? null,
            reportingInstructions: row.reportingInstructions ?? null,
            whatToBring: row.whatToBring ?? null,
            interviewerName: row.interviewerName ?? null,
            interviewerTitle: row.interviewerTitle ?? null,
            mapUrl: row.mapUrl ?? null,
            applicationUrl: `${appUrl}/candidate/applications/${row.applicationId}`,
            company: { name: row.companyName, logoUrl: row.companyLogoUrl },
          }),
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
      details: {
        remindersSent: sent,
        candidatesScanned: due.length,
        durationMs,
      },
    });
    this.logger.log(
      `[${CRON_NAME}] sent ${sent}/${due.length} reminders in ${durationMs}ms`,
    );
    return { remindersSent: sent, durationMs };
  }
}
