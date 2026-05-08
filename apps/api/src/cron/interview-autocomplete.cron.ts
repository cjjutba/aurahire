import { Cron } from "@nestjs/schedule";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { interviewsTable, applicationsTable } from "@aurahire/db";

import { AUDIT_ACTIONS, AuditService } from "../audit";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../db/db.module";
import { NotificationsService } from "../modules/notifications/notifications.service";
import { EventsService } from "../realtime";

const CRON_NAME = "interview-autocomplete";
// audit_logs.entity_id is NOT NULL UUID; sentinel for cron-level entries.
const CRON_ENTITY_SENTINEL = "00000000-0000-0000-0000-000000000000";
const GRACE_MINUTES = 15;

@Injectable()
export class InterviewAutocompleteCron {
  private readonly logger = new Logger(InterviewAutocompleteCron.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly notifications: NotificationsService,
    private readonly events: EventsService,
    private readonly audit: AuditService,
  ) {}

  /** Hourly at minute 0. */
  @Cron("0 * * * *", { name: CRON_NAME, timeZone: "Asia/Manila" })
  async run(): Promise<{ completed: number; durationMs: number }> {
    return this.execute();
  }

  /** Public for the dev-only debug endpoint to invoke manually. */
  async execute(): Promise<{ completed: number; durationMs: number }> {
    const startedAt = Date.now();

    const due = await this.db
      .select({
        id: interviewsTable.id,
        applicationId: interviewsTable.applicationId,
        scheduledBy: interviewsTable.scheduledBy,
        candidateId: applicationsTable.candidateId,
        jobId: applicationsTable.jobId,
      })
      .from(interviewsTable)
      .innerJoin(applicationsTable, eq(applicationsTable.id, interviewsTable.applicationId))
      .where(
        and(
          eq(interviewsTable.status, "scheduled"),
          // Drizzle has no native interval-arithmetic helper for column-derived values;
          // raw SQL computes interview end time = scheduledAt + durationMinutes + grace.
          sql`(${interviewsTable.scheduledAt} + ((${interviewsTable.durationMinutes} + ${GRACE_MINUTES}) || ' minutes')::interval) <= now()`,
        ),
      )
      .limit(200);

    let completed = 0;
    for (const row of due) {
      try {
        const [updated] = await this.db
          .update(interviewsTable)
          .set({ status: "completed", updatedAt: new Date() })
          .where(
            and(
              eq(interviewsTable.id, row.id),
              eq(interviewsTable.status, "scheduled"),
            ),
          )
          .returning({ id: interviewsTable.id });

        if (!updated) continue; // race lost — already moved by another path.

        await this.audit.log({
          actorId: null,
          actorType: "system",
          action: AUDIT_ACTIONS.INTERVIEW_AUTO_COMPLETED,
          entityType: "interview",
          entityId: row.id,
          details: { applicationId: row.applicationId },
        });

        const completedAt = new Date().toISOString();
        this.events.emitInterviewCompleted({
          interviewId: row.id,
          applicationId: row.applicationId,
          candidateId: row.candidateId,
          recruiterId: row.scheduledBy,
          jobId: row.jobId,
          completedAt,
        });

        await this.notifications.emit({
          userId: row.candidateId,
          eventType: "interview_completed",
          entityType: "interview",
          entityId: row.id,
          metadata: { applicationId: row.applicationId },
        });
        await this.notifications.emit({
          userId: row.scheduledBy,
          eventType: "interview_record_feedback",
          entityType: "interview",
          entityId: row.id,
          metadata: { applicationId: row.applicationId },
        });

        completed += 1;
      } catch (err) {
        this.logger.error(
          `[${CRON_NAME}] failed for interview ${row.id}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }

    const durationMs = Date.now() - startedAt;
    await this.audit.log({
      actorId: null,
      actorType: "system",
      action: AUDIT_ACTIONS.INTERVIEW_AUTOCOMPLETE_RUN,
      entityType: "cron",
      entityId: CRON_ENTITY_SENTINEL,
      details: { completed, scanned: due.length, durationMs },
    });
    this.logger.log(
      `[${CRON_NAME}] completed ${completed}/${due.length} in ${durationMs}ms`,
    );
    return { completed, durationMs };
  }
}
