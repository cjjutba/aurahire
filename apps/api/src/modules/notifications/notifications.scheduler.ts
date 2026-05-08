import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Cron } from "@nestjs/schedule";
import type { Queue } from "bullmq";
import { eq, inArray, sql } from "drizzle-orm";
import {
  applicationsTable,
  interviewsTable,
  jobsTable,
  notificationsTable,
  offersTable,
} from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";
import { NotificationsService } from "./notifications.service";
import { NOTIFICATION_EMAIL_QUEUE, type NotificationEmailJobData } from "./queues";

const QUERY_LIMIT = 500;

/**
 * Consolidated scheduler for the proactive-system slice (Phase 1, F9–F13):
 *
 *  • F9  runInterviewReminder       — emit interview_reminder_24h to candidates
 *                                    whose interviews fire in [now+23h, now+24h].
 *  • F10 runOfferExpiration         — warn candidates 24h before pending offers
 *                                    expire; auto-transition past-due pending
 *                                    offers to "expired" and notify both sides.
 *  • F11 runJobDeadlineArchive      — archive published jobs whose application
 *                                    deadline has passed; notify recruiter.
 *  • F12 runFeedbackDueReminder     — nudge recruiters every 6h about completed
 *                                    interviews lacking feedback after 24h.
 *  • F13 runDigest                  — group digest_pending notifications per
 *                                    user and enqueue a daily digest email.
 *
 * Each method is independently try/catch-wrapped so a single failure does not
 * prevent later iterations or other crons from running. Queries cap at
 * QUERY_LIMIT to bound memory under unexpected backlogs.
 *
 * Note: this codebase already ships a parallel set of crons under
 * `apps/api/src/cron/*.cron.ts`; those remain in place for backward-compat
 * with the cron-admin debug controller while this consolidated scheduler is
 * the canonical proactive-system surface going forward.
 */
@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly notifications: NotificationsService,
    @InjectQueue(NOTIFICATION_EMAIL_QUEUE)
    private readonly emailQueue: Queue<NotificationEmailJobData>,
  ) {}

  /** F9 — daily at 00:05 UTC. */
  @Cron("0 5 * * *", { name: "ns-interview-reminder", timeZone: "UTC" })
  async runInterviewReminder(): Promise<void> {
    try {
      const interviews = await this.db
        .select({
          id: interviewsTable.id,
          applicationId: interviewsTable.applicationId,
          scheduledAt: interviewsTable.scheduledAt,
          candidateId: applicationsTable.candidateId,
          jobId: applicationsTable.jobId,
        })
        .from(interviewsTable)
        .innerJoin(applicationsTable, eq(applicationsTable.id, interviewsTable.applicationId))
        .where(
          sql`${interviewsTable.status} = 'scheduled'
            AND ${interviewsTable.scheduledAt} BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '24 hours'`,
        )
        .limit(QUERY_LIMIT);

      this.logger.log(`runInterviewReminder: ${interviews.length} matching`);
      for (const iv of interviews) {
        try {
          await this.notifications.emit({
            userId: iv.candidateId,
            eventType: "interview_reminder_24h",
            entityType: "interview",
            entityId: iv.id,
            metadata: {
              interviewId: iv.id,
              applicationId: iv.applicationId,
              jobId: iv.jobId,
              scheduledAt: iv.scheduledAt.toISOString(),
            },
          });
        } catch (innerErr) {
          this.logger.error(
            `runInterviewReminder: emit failed for interview ${iv.id}: ${(innerErr as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error("runInterviewReminder failed", (err as Error).stack);
    }
  }

  /** F10 — daily at 00:10 UTC. Two passes: warn-soon + transition-expired. */
  @Cron("10 0 * * *", { name: "ns-offer-expiration", timeZone: "UTC" })
  async runOfferExpiration(): Promise<void> {
    try {
      // Pass A — pending offers expiring in the next 24h → warn candidate.
      const expiringSoon = await this.db
        .select({
          id: offersTable.id,
          applicationId: offersTable.applicationId,
          expiresAt: offersTable.expiresAt,
          candidateId: applicationsTable.candidateId,
          jobId: applicationsTable.jobId,
        })
        .from(offersTable)
        .innerJoin(applicationsTable, eq(applicationsTable.id, offersTable.applicationId))
        .where(
          sql`${offersTable.status} = 'pending'
            AND ${offersTable.expiresAt} IS NOT NULL
            AND ${offersTable.expiresAt} BETWEEN NOW() AND NOW() + INTERVAL '24 hours'`,
        )
        .limit(QUERY_LIMIT);

      for (const offer of expiringSoon) {
        try {
          await this.notifications.emit({
            userId: offer.candidateId,
            eventType: "offer_expiring_soon",
            entityType: "offer",
            entityId: offer.id,
            metadata: {
              offerId: offer.id,
              applicationId: offer.applicationId,
              jobId: offer.jobId,
              expiresAt: offer.expiresAt ? offer.expiresAt.toISOString() : null,
            },
          });
        } catch (innerErr) {
          this.logger.error(
            `runOfferExpiration[soon]: emit failed for offer ${offer.id}: ${(innerErr as Error).message}`,
          );
        }
      }

      // Pass B — pending offers already past expires_at → transition to expired
      // and notify both candidate and the owning recruiter.
      const expired = await this.db
        .select({
          id: offersTable.id,
          applicationId: offersTable.applicationId,
          candidateId: applicationsTable.candidateId,
          jobId: applicationsTable.jobId,
          recruiterId: jobsTable.recruiterId,
        })
        .from(offersTable)
        .innerJoin(applicationsTable, eq(applicationsTable.id, offersTable.applicationId))
        .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
        .where(
          sql`${offersTable.status} = 'pending'
            AND ${offersTable.expiresAt} IS NOT NULL
            AND ${offersTable.expiresAt} < NOW()`,
        )
        .limit(QUERY_LIMIT);

      for (const offer of expired) {
        try {
          await this.db
            .update(offersTable)
            .set({ status: "expired", updatedAt: new Date() })
            .where(eq(offersTable.id, offer.id));

          // notify candidate
          await this.notifications.emit({
            userId: offer.candidateId,
            eventType: "offer_expired",
            entityType: "offer",
            entityId: offer.id,
            metadata: {
              offerId: offer.id,
              applicationId: offer.applicationId,
              jobId: offer.jobId,
            },
          });

          // notify owning recruiter (single recruiter_id today; emitMany is
          // forward-compatible if the schema ever grows a hiring-team set).
          await this.notifications.emitMany([offer.recruiterId], {
            eventType: "offer_expired",
            entityType: "offer",
            entityId: offer.id,
            metadata: {
              offerId: offer.id,
              applicationId: offer.applicationId,
              jobId: offer.jobId,
              candidateId: offer.candidateId,
            },
          });
        } catch (innerErr) {
          this.logger.error(
            `runOfferExpiration[expired]: failed for offer ${offer.id}: ${(innerErr as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error("runOfferExpiration failed", (err as Error).stack);
    }
  }

  /** F11 — daily at 00:15 UTC. Auto-archive published jobs past their deadline. */
  @Cron("15 0 * * *", { name: "ns-job-deadline-archive", timeZone: "UTC" })
  async runJobDeadlineArchive(): Promise<void> {
    try {
      // application_deadline is a DATE column; comparing against today's ISO
      // date keeps the predicate index-friendly.
      const todayIso = new Date().toISOString().slice(0, 10);

      const past = await this.db
        .select({
          id: jobsTable.id,
          title: jobsTable.title,
          recruiterId: jobsTable.recruiterId,
          applicationDeadline: jobsTable.applicationDeadline,
        })
        .from(jobsTable)
        .where(
          sql`${jobsTable.status} = 'published'
            AND ${jobsTable.applicationDeadline} IS NOT NULL
            AND ${jobsTable.applicationDeadline} < ${todayIso}`,
        )
        .limit(QUERY_LIMIT);

      for (const job of past) {
        try {
          await this.db
            .update(jobsTable)
            .set({
              status: "archived",
              archivedReason: "deadline_passed",
              updatedAt: new Date(),
            })
            .where(eq(jobsTable.id, job.id));

          await this.notifications.emitMany([job.recruiterId], {
            eventType: "job_archived_by_deadline",
            entityType: "job",
            entityId: job.id,
            metadata: {
              jobId: job.id,
              title: job.title,
              deadline: job.applicationDeadline,
            },
          });
        } catch (innerErr) {
          this.logger.error(
            `runJobDeadlineArchive: failed for job ${job.id}: ${(innerErr as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error("runJobDeadlineArchive failed", (err as Error).stack);
    }
  }

  /** F12 — every 6 hours. */
  @Cron("0 */6 * * *", { name: "ns-feedback-due", timeZone: "UTC" })
  async runFeedbackDueReminder(): Promise<void> {
    try {
      // "Completed" interviews lacking feedback past a 24h grace, where the
      // last reminder (if any) is itself > 24h old. The OR-clause produces a
      // periodic 24h cadence (e.g. first nudge at 24h, second at 48h, etc.)
      // until feedback is filed.
      //
      // The schema does not carry a separate `completed_at`; an interview is
      // "completed" once status='completed', and its earliest possible
      // completion is `scheduled_at + duration_minutes`. We use that as the
      // grace anchor to remain conservative (never nudge before the
      // interview's nominal end).
      const due = await this.db
        .select({
          id: interviewsTable.id,
          applicationId: interviewsTable.applicationId,
          recruiterId: interviewsTable.scheduledBy,
          scheduledAt: interviewsTable.scheduledAt,
          durationMinutes: interviewsTable.durationMinutes,
          candidateId: applicationsTable.candidateId,
          jobId: applicationsTable.jobId,
        })
        .from(interviewsTable)
        .innerJoin(applicationsTable, eq(applicationsTable.id, interviewsTable.applicationId))
        .where(
          sql`${interviewsTable.status} = 'completed'
            AND ${interviewsTable.feedback} IS NULL
            AND (${interviewsTable.scheduledAt} + (${interviewsTable.durationMinutes} || ' minutes')::interval)
              < NOW() - INTERVAL '24 hours'
            AND (
              ${interviewsTable.feedbackReminderSentAt} IS NULL
              OR ${interviewsTable.feedbackReminderSentAt} < NOW() - INTERVAL '24 hours'
            )`,
        )
        .limit(QUERY_LIMIT);

      for (const iv of due) {
        try {
          await this.notifications.emit({
            userId: iv.recruiterId,
            eventType: "interview_feedback_due",
            entityType: "interview",
            entityId: iv.id,
            metadata: {
              interviewId: iv.id,
              applicationId: iv.applicationId,
              candidateId: iv.candidateId,
              jobId: iv.jobId,
            },
          });
          await this.db
            .update(interviewsTable)
            .set({ feedbackReminderSentAt: new Date() })
            .where(eq(interviewsTable.id, iv.id));
        } catch (innerErr) {
          this.logger.error(
            `runFeedbackDueReminder: failed for interview ${iv.id}: ${(innerErr as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error("runFeedbackDueReminder failed", (err as Error).stack);
    }
  }

  /** F13 — daily at 09:00 UTC. */
  @Cron("0 9 * * *", { name: "ns-digest", timeZone: "UTC" })
  async runDigest(): Promise<void> {
    try {
      // Group all digest_pending rows still visible (not dismissed) by user.
      // Per Task 1 column mapping: notifications uses `dismissed_at`, not
      // `archived_at`.
      const result = await this.db.execute<{
        user_id: string;
        notification_ids: string[];
      }>(sql`
        SELECT user_id, ARRAY_AGG(id) AS notification_ids
        FROM notifications
        WHERE digest_pending = true AND dismissed_at IS NULL
        GROUP BY user_id
        LIMIT ${QUERY_LIMIT}
      `);

      // drizzle-orm/postgres-js returns rows as an array directly. Some test
      // doubles return `{ rows: [...] }` shape (pg-style); accept both.
      const rows: Array<{ user_id: string; notification_ids: string[] }> = Array.isArray(result)
        ? (result as Array<{ user_id: string; notification_ids: string[] }>)
        : ((result as unknown as { rows?: Array<{ user_id: string; notification_ids: string[] }> })
            .rows ?? []);

      for (const row of rows) {
        try {
          await this.emailQueue.add(
            "digest-email",
            {
              kind: "digest",
              userId: row.user_id,
              notificationIds: row.notification_ids,
            },
            { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
          );

          if (row.notification_ids.length > 0) {
            await this.db
              .update(notificationsTable)
              .set({ digestPending: false })
              .where(inArray(notificationsTable.id, row.notification_ids));
          }
        } catch (innerErr) {
          this.logger.error(
            `runDigest: failed for user ${row.user_id}: ${(innerErr as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error("runDigest failed", (err as Error).stack);
    }
  }
}
