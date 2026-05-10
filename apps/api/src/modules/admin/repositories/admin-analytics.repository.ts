import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  applicationsTable,
  jobsTable,
  matchScoresTable,
  profilesTable,
} from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../../db/db.module";

@Injectable()
export class AdminAnalyticsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  // -----------------------------------------------------------------
  // KPIs
  // -----------------------------------------------------------------

  async totalUsers(): Promise<number> {
    const rows = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(profilesTable)
      .where(sql`${profilesTable.status} <> 'deleted'`);
    return rows[0]?.c ?? 0;
  }

  async newUsersInRange(from: Date, to: Date): Promise<number> {
    const rows = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(profilesTable)
      .where(
        and(
          sql`${profilesTable.status} <> 'deleted'`,
          gte(profilesTable.createdAt, from),
          lte(profilesTable.createdAt, to),
        ),
      );
    return rows[0]?.c ?? 0;
  }

  async activeJobs(): Promise<number> {
    const rows = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(jobsTable)
      .where(eq(jobsTable.status, "published"));
    return rows[0]?.c ?? 0;
  }

  async applicationsCountInRange(from: Date, to: Date): Promise<number> {
    const rows = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(applicationsTable)
      .where(
        and(
          gte(applicationsTable.appliedAt, from),
          lte(applicationsTable.appliedAt, to),
        ),
      );
    return rows[0]?.c ?? 0;
  }

  /** Median time-to-hire in days for hired applications in range. */
  async medianTimeToHireDays(from: Date, to: Date): Promise<number | null> {
    const [row] = await this.db
      .select({
        median: sql<number | null>`
          EXTRACT(EPOCH FROM percentile_cont(0.5) WITHIN GROUP (
            ORDER BY (${applicationsTable.statusUpdatedAt} - ${applicationsTable.appliedAt})
          )) / 86400
        `,
      })
      .from(applicationsTable)
      .where(
        and(
          eq(applicationsTable.status, "hired"),
          gte(applicationsTable.statusUpdatedAt, from),
          lte(applicationsTable.statusUpdatedAt, to),
        ),
      );
    return row?.median != null ? Math.round(row.median * 10) / 10 : null;
  }

  // -----------------------------------------------------------------
  // CHARTS
  // -----------------------------------------------------------------

  async userGrowthByDay(
    from: Date,
    to: Date,
  ): Promise<Array<{ date: string; role: string; count: number }>> {
    const rows = await this.db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${profilesTable.createdAt}), 'YYYY-MM-DD')`,
        role: profilesTable.role,
        count: sql<number>`count(*)::int`,
      })
      .from(profilesTable)
      .where(
        and(
          sql`${profilesTable.status} <> 'deleted'`,
          gte(profilesTable.createdAt, from),
          lte(profilesTable.createdAt, to),
        ),
      )
      .groupBy(
        sql`date_trunc('day', ${profilesTable.createdAt})`,
        profilesTable.role,
      )
      .orderBy(sql`date_trunc('day', ${profilesTable.createdAt})`);
    return rows.map((r) => ({ date: r.date, role: r.role, count: r.count }));
  }

  async jobsByDay(
    from: Date,
    to: Date,
  ): Promise<Array<{ date: string; status: string; count: number }>> {
    const rows = await this.db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${jobsTable.createdAt}), 'YYYY-MM-DD')`,
        status: jobsTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(jobsTable)
      .where(and(gte(jobsTable.createdAt, from), lte(jobsTable.createdAt, to)))
      .groupBy(sql`date_trunc('day', ${jobsTable.createdAt})`, jobsTable.status)
      .orderBy(sql`date_trunc('day', ${jobsTable.createdAt})`);
    return rows.map((r) => ({
      date: r.date,
      status: r.status,
      count: r.count,
    }));
  }

  async applicationsByDay(
    from: Date,
    to: Date,
  ): Promise<Array<{ date: string; status: string; count: number }>> {
    const rows = await this.db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${applicationsTable.appliedAt}), 'YYYY-MM-DD')`,
        status: applicationsTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(applicationsTable)
      .where(
        and(
          gte(applicationsTable.appliedAt, from),
          lte(applicationsTable.appliedAt, to),
        ),
      )
      .groupBy(
        sql`date_trunc('day', ${applicationsTable.appliedAt})`,
        applicationsTable.status,
      )
      .orderBy(sql`date_trunc('day', ${applicationsTable.appliedAt})`);
    return rows.map((r) => ({
      date: r.date,
      status: r.status,
      count: r.count,
    }));
  }

  /** 10-pt buckets across all match_scores in range. */
  async scoreDistribution(
    from: Date,
    to: Date,
  ): Promise<Array<{ bucket: string; count: number }>> {
    const rows = await this.db
      .select({
        bucket: sql<string>`
          CASE
            WHEN ${matchScoresTable.overallScore} >= 90 THEN '90-100'
            WHEN ${matchScoresTable.overallScore} >= 80 THEN '80-89'
            WHEN ${matchScoresTable.overallScore} >= 70 THEN '70-79'
            WHEN ${matchScoresTable.overallScore} >= 60 THEN '60-69'
            WHEN ${matchScoresTable.overallScore} >= 50 THEN '50-59'
            WHEN ${matchScoresTable.overallScore} >= 40 THEN '40-49'
            WHEN ${matchScoresTable.overallScore} >= 30 THEN '30-39'
            WHEN ${matchScoresTable.overallScore} >= 20 THEN '20-29'
            WHEN ${matchScoresTable.overallScore} >= 10 THEN '10-19'
            ELSE '0-9'
          END
        `,
        count: sql<number>`count(*)::int`,
      })
      .from(matchScoresTable)
      .where(
        and(
          gte(matchScoresTable.createdAt, from),
          lte(matchScoresTable.createdAt, to),
        ),
      )
      .groupBy(sql`1`);
    return rows;
  }

  /**
   * AI processing time per day.
   *
   * Resumes table has no `parseLatencyMs` column in current schema, so we
   * surface 0 for parse latency and only chart match-score latencies.
   * (Plan permits this fallback.)
   */
  async aiProcessingTimeByDay(
    from: Date,
    to: Date,
  ): Promise<Array<{ date: string; avgParseMs: number; avgScoreMs: number }>> {
    const scoreRows = await this.db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${matchScoresTable.createdAt}), 'YYYY-MM-DD')`,
        avg: sql<number | null>`avg(${matchScoresTable.latencyMs})::float`,
      })
      .from(matchScoresTable)
      .where(
        and(
          gte(matchScoresTable.createdAt, from),
          lte(matchScoresTable.createdAt, to),
        ),
      )
      .groupBy(sql`date_trunc('day', ${matchScoresTable.createdAt})`)
      .orderBy(sql`date_trunc('day', ${matchScoresTable.createdAt})`);

    return scoreRows.map((r) => ({
      date: r.date,
      avgParseMs: 0,
      avgScoreMs: Math.round(r.avg ?? 0),
    }));
  }

  async topRecruiters(limit: number): Promise<
    Array<{
      recruiterId: string;
      fullName: string;
      jobCount: number;
      applicationCount: number;
    }>
  > {
    const rows = await this.db
      .select({
        recruiterId: profilesTable.id,
        fullName: profilesTable.fullName,
        jobCount: sql<number>`count(distinct ${jobsTable.id})::int`,
        applicationCount: sql<number>`count(distinct ${applicationsTable.id})::int`,
      })
      .from(profilesTable)
      .innerJoin(jobsTable, eq(jobsTable.recruiterId, profilesTable.id))
      .leftJoin(applicationsTable, eq(applicationsTable.jobId, jobsTable.id))
      .where(eq(profilesTable.role, "recruiter"))
      .groupBy(profilesTable.id, profilesTable.fullName)
      .orderBy(desc(sql<number>`count(distinct ${jobsTable.id})`))
      .limit(limit);
    return rows;
  }
}
