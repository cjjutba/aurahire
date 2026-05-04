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

export interface OverviewSnapshot {
  totalUsers: number;
  activeJobs: number;
  applicationsToday: number;
  applicationsThisWeek: number;
  avgProfileScore: number;
  avgMatchScore: number;
  scoreBandHistogram: Array<{ band: string; count: number }>;
  biasFlagsThisWeek: Array<{ category: string; count: number }>;
  recentAuditEvents: Array<{
    action: string;
    actorType: string;
    entityType: string;
    createdAt: Date;
  }>;
}

@Injectable()
export class AdminStatsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  /**
   * Single-round-trip aggregate fetch. Replaces 9 separate queries with one
   * SQL statement using scalar subqueries and json_agg, cutting cold-start
   * latency from ~6s to ~500ms when the DB is in a remote region.
   */
  async overview(params: {
    todayStart: Date;
    weekStart: Date;
    histogramSinceDays: number;
    auditLimit: number;
  }): Promise<OverviewSnapshot> {
    const histogramSince = new Date(
      Date.now() - params.histogramSinceDays * DAY_MS,
    );

    // Drizzle's raw sql template doesn't auto-serialize Date instances the way
    // its typed query helpers (gte/lte) do. The postgres-js driver expects
    // strings for timestamptz parameters in this path, so we serialize each
    // Date to ISO before embedding. Without this the driver crashes inside
    // Buffer.byteLength on parameter binding.
    const todayStartIso = params.todayStart.toISOString();
    const weekStartIso = params.weekStart.toISOString();
    const histogramSinceIso = histogramSince.toISOString();

    const result = await this.db.execute<{
      total_users: number;
      active_jobs: number;
      apps_today: number;
      apps_this_week: number;
      avg_profile_score: number;
      avg_match_score: number;
      score_band_histogram: Array<{ band: string; count: number }> | null;
      bias_flags_this_week: Array<{ category: string; count: number }> | null;
      recent_audit_events:
        | Array<{
            action: string;
            actorType: string;
            entityType: string;
            createdAt: string;
          }>
        | null;
    }>(sql`
      SELECT
        (SELECT count(*)::int FROM profiles WHERE status <> 'deleted') AS total_users,
        (SELECT count(*)::int FROM jobs WHERE status = 'published') AS active_jobs,
        (SELECT count(*)::int FROM applications WHERE applied_at >= ${todayStartIso}) AS apps_today,
        (SELECT count(*)::int FROM applications WHERE applied_at >= ${weekStartIso}) AS apps_this_week,
        COALESCE((SELECT round(avg(overall_score))::int FROM profile_scores), 0) AS avg_profile_score,
        COALESCE((SELECT round(avg(overall_score))::int FROM match_scores), 0) AS avg_match_score,
        (
          SELECT json_agg(json_build_object('band', band, 'count', cnt))
          FROM (
            SELECT band, count(*)::int AS cnt
            FROM match_scores
            WHERE created_at >= ${histogramSinceIso}
            GROUP BY band
          ) t
        ) AS score_band_histogram,
        (
          SELECT json_agg(json_build_object('category', category, 'count', cnt))
          FROM (
            SELECT category, count(*)::int AS cnt
            FROM bias_flags
            WHERE created_at >= ${weekStartIso}
            GROUP BY category
          ) t
        ) AS bias_flags_this_week,
        (
          SELECT json_agg(
            json_build_object(
              'action', action,
              'actorType', actor_type,
              'entityType', entity_type,
              'createdAt', created_at
            )
          )
          FROM (
            SELECT action, actor_type, entity_type, created_at
            FROM audit_logs
            ORDER BY created_at DESC
            LIMIT ${params.auditLimit}
          ) t
        ) AS recent_audit_events
    `);

    const row = result[0] as
      | {
          total_users: number;
          active_jobs: number;
          apps_today: number;
          apps_this_week: number;
          avg_profile_score: number;
          avg_match_score: number;
          score_band_histogram: Array<{ band: string; count: number }> | null;
          bias_flags_this_week:
            | Array<{ category: string; count: number }>
            | null;
          recent_audit_events:
            | Array<{
                action: string;
                actorType: string;
                entityType: string;
                createdAt: string;
              }>
            | null;
        }
      | undefined;

    return {
      totalUsers: Number(row?.total_users ?? 0),
      activeJobs: Number(row?.active_jobs ?? 0),
      applicationsToday: Number(row?.apps_today ?? 0),
      applicationsThisWeek: Number(row?.apps_this_week ?? 0),
      avgProfileScore: Number(row?.avg_profile_score ?? 0),
      avgMatchScore: Number(row?.avg_match_score ?? 0),
      scoreBandHistogram: row?.score_band_histogram ?? [],
      biasFlagsThisWeek: row?.bias_flags_this_week ?? [],
      recentAuditEvents: (row?.recent_audit_events ?? []).map((e) => ({
        action: e.action,
        actorType: e.actorType,
        entityType: e.entityType,
        createdAt: new Date(e.createdAt),
      })),
    };
  }

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
