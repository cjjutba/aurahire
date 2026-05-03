import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { and, eq, lt, sql } from "drizzle-orm";
import { jobsTable } from "@aurahire/db";

import { AUDIT_ACTIONS, AuditService } from "../audit";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../db/db.module";

const CRON_NAME = "archive-past-deadline-jobs";
const CRON_ENTITY_SENTINEL = "00000000-0000-0000-0000-000000000000";

@Injectable()
export class ArchivePastDeadlineJobsCron {
  private readonly logger = new Logger(ArchivePastDeadlineJobsCron.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly audit: AuditService,
  ) {}

  /** Daily at 00:00 server time (UTC in dev container). */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: CRON_NAME })
  async run(): Promise<{ affectedRows: number; durationMs: number }> {
    return this.execute();
  }

  async execute(): Promise<{ affectedRows: number; durationMs: number }> {
    const startedAt = Date.now();

    try {
      // applicationDeadline is a DATE column. Compare against today's date in
      // ISO yyyy-mm-dd; strict less-than means "deadline passed".
      const todayIso = new Date().toISOString().slice(0, 10);

      const candidates = await this.db
        .select({
          id: jobsTable.id,
          title: jobsTable.title,
          recruiterId: jobsTable.recruiterId,
        })
        .from(jobsTable)
        .where(
          and(
            eq(jobsTable.status, "published"),
            sql`${jobsTable.applicationDeadline} IS NOT NULL`,
            lt(jobsTable.applicationDeadline, todayIso),
          ),
        );

      if (candidates.length === 0) {
        const durationMs = Date.now() - startedAt;
        this.logger.log(`[${CRON_NAME}] nothing to archive`);
        await this.audit.log({
          actorId: null,
          actorType: "system",
          action: AUDIT_ACTIONS.CRON_ARCHIVE_PAST_DEADLINE_JOBS_EXECUTED,
          entityType: "cron",
          entityId: CRON_ENTITY_SENTINEL,
          details: { affectedRows: 0, durationMs },
        });
        return { affectedRows: 0, durationMs };
      }

      const ids = candidates.map((c) => c.id);
      await this.db
        .update(jobsTable)
        .set({ status: "archived", updatedAt: new Date() })
        .where(sql`${jobsTable.id} = ANY(${ids}::uuid[])`);

      for (const c of candidates) {
        await this.audit.log({
          actorId: null,
          actorType: "system",
          action: AUDIT_ACTIONS.JOB_ARCHIVED_BY_CRON,
          entityType: "job",
          entityId: c.id,
          details: { title: c.title, recruiterId: c.recruiterId },
        });
      }

      const durationMs = Date.now() - startedAt;
      await this.audit.log({
        actorId: null,
        actorType: "system",
        action: AUDIT_ACTIONS.CRON_ARCHIVE_PAST_DEADLINE_JOBS_EXECUTED,
        entityType: "cron",
        entityId: CRON_ENTITY_SENTINEL,
        details: { affectedRows: candidates.length, durationMs },
      });

      this.logger.log(
        `[${CRON_NAME}] archived ${candidates.length} job(s) in ${durationMs}ms`,
      );
      return { affectedRows: candidates.length, durationMs };
    } catch (err) {
      this.logger.error(`[${CRON_NAME}] failed: ${(err as Error).message}`);
      throw err;
    }
  }
}
