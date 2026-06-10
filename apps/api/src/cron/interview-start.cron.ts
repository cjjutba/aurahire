import { Cron } from "@nestjs/schedule";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import {
  interviewsTable,
  applicationsTable,
  jobsTable,
  companiesTable,
  profilesTable,
} from "@aurahire/db";

import { AUDIT_ACTIONS, AuditService } from "../audit";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../db/db.module";
import { NotificationsService } from "../modules/notifications/notifications.service";
import { EventsService } from "../realtime";

const CRON_NAME = "interview-start";
const CRON_ENTITY_SENTINEL = "00000000-0000-0000-0000-000000000000";

/**
 * Auto-transitions interviews from `scheduled` to `in_progress` when
 * the scheduled start time arrives. Per thesis panel revision (May
 * 2026): the interview lifecycle now models the "happening right now"
 * phase explicitly so the recruiter sees a clean STARTED → COMPLETED
 * progression in real time. The companion `interview-autocomplete`
 * cron handles the next hop (in_progress → completed) once
 * scheduledAt + durationMinutes + grace has elapsed.
 *
 * Runs every minute because interview times are minute-precise; a
 * coarser tick (e.g. hourly) would mean a 4:05 PM interview shows as
 * "scheduled" until 5:00 PM. Every-minute scans are cheap - the WHERE
 * clause is bounded to interviews that just became due.
 */
@Injectable()
export class InterviewStartCron {
  private readonly logger = new Logger(InterviewStartCron.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly notifications: NotificationsService,
    private readonly events: EventsService,
    private readonly audit: AuditService,
  ) {}

  /** Every minute. */
  @Cron("* * * * *", { name: CRON_NAME, timeZone: "Asia/Manila" })
  async run(): Promise<{ started: number; durationMs: number }> {
    return this.execute();
  }

  /** Public for the dev-only debug endpoint to invoke manually. */
  async execute(): Promise<{ started: number; durationMs: number }> {
    const startedAt = Date.now();

    // Find scheduled interviews whose start time has arrived. The
    // upper bound (scheduledAt > now() - 2 hours) keeps the cron from
    // re-flipping interviews that were already past-due when the
    // database came online or the cron was paused for a long stretch.
    // Those forgotten rows are caught by the autocomplete cron's
    // direct scheduled → completed sweep instead.
    const due = await this.db
      .select({
        id: interviewsTable.id,
        applicationId: interviewsTable.applicationId,
        scheduledBy: interviewsTable.scheduledBy,
        scheduledAt: interviewsTable.scheduledAt,
        durationMinutes: interviewsTable.durationMinutes,
        candidateId: applicationsTable.candidateId,
        jobId: applicationsTable.jobId,
        jobTitle: jobsTable.title,
        companyName: companiesTable.name,
        candidateName: profilesTable.fullName,
      })
      .from(interviewsTable)
      .innerJoin(
        applicationsTable,
        eq(applicationsTable.id, interviewsTable.applicationId),
      )
      .leftJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .leftJoin(companiesTable, eq(companiesTable.id, jobsTable.companyId))
      .leftJoin(
        profilesTable,
        eq(profilesTable.id, applicationsTable.candidateId),
      )
      .where(
        and(
          eq(interviewsTable.status, "scheduled"),
          sql`${interviewsTable.scheduledAt} <= now()`,
          sql`${interviewsTable.scheduledAt} > now() - interval '2 hours'`,
        ),
      )
      .limit(200);

    let started = 0;
    for (const row of due) {
      try {
        const [updated] = await this.db
          .update(interviewsTable)
          .set({ status: "in_progress", updatedAt: new Date() })
          .where(
            and(
              eq(interviewsTable.id, row.id),
              eq(interviewsTable.status, "scheduled"),
            ),
          )
          .returning({ id: interviewsTable.id });

        if (!updated) continue; // race lost - already moved by another path.

        await this.audit.log({
          actorId: null,
          actorType: "system",
          action: AUDIT_ACTIONS.INTERVIEW_AUTO_STARTED,
          entityType: "interview",
          entityId: row.id,
          details: { applicationId: row.applicationId },
        });

        this.events.emitInterviewStatusChanged({
          interviewId: row.id,
          applicationId: row.applicationId,
          recruiterId: row.scheduledBy,
          candidateId: row.candidateId,
          previousStatus: "scheduled",
          status: "in_progress",
          changedAt: new Date().toISOString(),
        });

        // No candidate-facing notification on auto-start - recruiters
        // see the realtime status flip in the portal, and the candidate
        // already got the interview-scheduled invite. Spamming them
        // again at the start moment would feel noisy.

        started += 1;
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
      action: AUDIT_ACTIONS.INTERVIEW_START_RUN,
      entityType: "cron",
      entityId: CRON_ENTITY_SENTINEL,
      details: { started, scanned: due.length, durationMs },
    });
    this.logger.log(
      `[${CRON_NAME}] started ${started}/${due.length} in ${durationMs}ms`,
    );
    return { started, durationMs };
  }
}
