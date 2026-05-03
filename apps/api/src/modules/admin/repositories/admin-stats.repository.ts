import { Inject, Injectable } from "@nestjs/common";
import { desc, eq, gte, sql } from "drizzle-orm";
import {
  applicationsTable,
  auditLogsTable,
  biasFlagsTable,
  jobsTable,
  matchScoresTable,
  profilesTable,
  profileScoresTable,
} from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../../db/db.module";

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminStatsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async countUsers(): Promise<number> {
    const rows = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(profilesTable)
      .where(sql`${profilesTable.status} <> 'deleted'`);
    return rows[0]?.c ?? 0;
  }

  async countActiveJobs(): Promise<number> {
    const rows = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(jobsTable)
      .where(eq(jobsTable.status, "published"));
    return rows[0]?.c ?? 0;
  }

  async countApplicationsSince(since: Date): Promise<number> {
    const rows = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(applicationsTable)
      .where(gte(applicationsTable.appliedAt, since));
    return rows[0]?.c ?? 0;
  }

  async avgProfileScore(): Promise<number> {
    const rows = await this.db
      .select({
        a: sql<number | null>`avg(${profileScoresTable.overallScore})::float`,
      })
      .from(profileScoresTable);
    return Math.round(rows[0]?.a ?? 0);
  }

  async avgMatchScore(): Promise<number> {
    const rows = await this.db
      .select({
        a: sql<number | null>`avg(${matchScoresTable.overallScore})::float`,
      })
      .from(matchScoresTable);
    return Math.round(rows[0]?.a ?? 0);
  }

  async scoreBandHistogram(
    sinceDays = 30,
  ): Promise<Array<{ band: string; count: number }>> {
    const since = new Date(Date.now() - sinceDays * DAY_MS);
    const rows = await this.db
      .select({
        band: matchScoresTable.band,
        count: sql<number>`count(*)::int`,
      })
      .from(matchScoresTable)
      .where(gte(matchScoresTable.createdAt, since))
      .groupBy(matchScoresTable.band);
    return rows.map((r) => ({ band: r.band, count: r.count }));
  }

  async biasFlagsThisWeek(): Promise<Array<{ category: string; count: number }>> {
    const since = new Date(Date.now() - 7 * DAY_MS);
    const rows = await this.db
      .select({
        category: biasFlagsTable.category,
        count: sql<number>`count(*)::int`,
      })
      .from(biasFlagsTable)
      .where(gte(biasFlagsTable.createdAt, since))
      .groupBy(biasFlagsTable.category);
    return rows.map((r) => ({ category: r.category, count: r.count }));
  }

  async recentAuditEvents(
    limit = 10,
  ): Promise<
    Array<{
      action: string;
      actorType: string;
      entityType: string;
      createdAt: Date;
    }>
  > {
    return this.db
      .select({
        action: auditLogsTable.action,
        actorType: auditLogsTable.actorType,
        entityType: auditLogsTable.entityType,
        createdAt: auditLogsTable.createdAt,
      })
      .from(auditLogsTable)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(limit);
  }
}
