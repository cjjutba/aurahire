import { ConfigService } from "@nestjs/config";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  interviewsTable,
  applicationsTable,
  profilesTable,
  jobsTable,
} from "@aurahire/db";

import { AUDIT_ACTIONS, AuditService } from "../audit";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../db/db.module";
import { NotificationsService } from "../modules/notifications/notifications.service";

const CRON_NAME = "interview-feedback-due";
// audit_logs.entity_id is NOT NULL UUID; sentinel for cron-level entries.
const CRON_ENTITY_SENTINEL = "00000000-0000-0000-0000-000000000000";
const FEEDBACK_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class InterviewFeedbackDueCron {
  private readonly logger = new Logger(InterviewFeedbackDueCron.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  /** Hourly at minute 0. */
  @Cron("0 * * * *", { name: CRON_NAME, timeZone: "Asia/Manila" })
  async run(): Promise<{ notified: number; durationMs: number }> {
    return this.execute();
  }

  /** Public for the dev-only debug endpoint. */
  async execute(): Promise<{ notified: number; durationMs: number }> {
    const startedAt = Date.now();
    const cutoff = new Date(Date.now() - FEEDBACK_GRACE_PERIOD_MS);

    const due = await this.db
      .select({
        interviewId: interviewsTable.id,
        recruiterId: interviewsTable.scheduledBy,
        candidateName: profilesTable.fullName,
        jobTitle: jobsTable.title,
      })
      .from(interviewsTable)
      .innerJoin(applicationsTable, eq(applicationsTable.id, interviewsTable.applicationId))
      .innerJoin(profilesTable, eq(profilesTable.id, applicationsTable.candidateId))
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .where(
        and(
          eq(interviewsTable.status, "completed"),
          isNull(interviewsTable.feedback),
          isNull(interviewsTable.feedbackDueNotifiedAt),
          // Drizzle has no native interval-arithmetic helper for column-derived values;
          // raw SQL computes interview end time = scheduledAt + durationMinutes.
          sql`(${interviewsTable.scheduledAt} + (${interviewsTable.durationMinutes} || ' minutes')::interval) < ${cutoff}::timestamptz`,
        ),
      )
      .limit(200);

    let notified = 0;
    for (const row of due) {
      try {
        await this.notifications.emit({
          userId: row.recruiterId,
          eventType: "interview_feedback_due",
          entityType: "interview",
          entityId: row.interviewId,
          metadata: {
            interviewId: row.interviewId,
            candidateName: row.candidateName,
            jobTitle: row.jobTitle,
          },
        });
        await this.db
          .update(interviewsTable)
          .set({ feedbackDueNotifiedAt: new Date() })
          .where(eq(interviewsTable.id, row.interviewId));
        notified += 1;
      } catch (err) {
        this.logger.error(
          `[${CRON_NAME}] feedback-due emit failed for interview ${row.interviewId}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }

    const durationMs = Date.now() - startedAt;
    await this.audit.log({
      actorId: null,
      actorType: "system",
      action: AUDIT_ACTIONS.INTERVIEW_FEEDBACK_DUE_RUN,
      entityType: "cron",
      entityId: CRON_ENTITY_SENTINEL,
      details: { notified, scanned: due.length, durationMs },
    });
    this.logger.log(`[${CRON_NAME}] notified ${notified}/${due.length} recruiters in ${durationMs}ms`);
    return { notified, durationMs };
  }
}
