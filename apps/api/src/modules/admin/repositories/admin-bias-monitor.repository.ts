import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  biasFlagsTable,
  jobsTable,
  matchScoresTable,
  profilesTable,
} from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../../db/db.module";

@Injectable()
export class AdminBiasMonitorRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async countFlagsInRange(
    from: Date,
    to: Date,
  ): Promise<{ total: number; overridden: number; resolved: number }> {
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        overridden: sql<number>`count(*) filter (where ${biasFlagsTable.status} = 'overridden')::int`,
        resolved: sql<number>`count(*) filter (where ${biasFlagsTable.status} = 'resolved')::int`,
      })
      .from(biasFlagsTable)
      .where(
        and(
          gte(biasFlagsTable.createdAt, from),
          lte(biasFlagsTable.createdAt, to),
        ),
      );
    return {
      total: row?.total ?? 0,
      overridden: row?.overridden ?? 0,
      resolved: row?.resolved ?? 0,
    };
  }

  async countPublishedJobsInRange(from: Date, to: Date): Promise<number> {
    const [row] = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.status, "published"),
          gte(jobsTable.createdAt, from),
          lte(jobsTable.createdAt, to),
        ),
      );
    return row?.c ?? 0;
  }

  async flagsByCategory(
    from: Date,
    to: Date,
  ): Promise<Array<{ category: string; count: number }>> {
    const rows = await this.db
      .select({
        category: biasFlagsTable.category,
        count: sql<number>`count(*)::int`,
      })
      .from(biasFlagsTable)
      .where(
        and(
          gte(biasFlagsTable.createdAt, from),
          lte(biasFlagsTable.createdAt, to),
        ),
      )
      .groupBy(biasFlagsTable.category)
      .orderBy(desc(sql<number>`count(*)`));
    return rows;
  }

  /**
   * Top N flagged terms with up to 3 example job IDs per term.
   */
  async topFlaggedTerms(
    from: Date,
    to: Date,
    limit: number,
  ): Promise<Array<{ term: string; count: number; exampleJobIds: string[] }>> {
    const rows = await this.db
      .select({
        term: biasFlagsTable.term,
        count: sql<number>`count(*)::int`,
        jobIds: sql<string[]>`array_agg(distinct ${biasFlagsTable.jobId}::text)`,
      })
      .from(biasFlagsTable)
      .where(
        and(
          gte(biasFlagsTable.createdAt, from),
          lte(biasFlagsTable.createdAt, to),
        ),
      )
      .groupBy(biasFlagsTable.term)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(limit);

    return rows.map((r) => ({
      term: r.term,
      count: r.count,
      exampleJobIds: (r.jobIds ?? []).slice(0, 3),
    }));
  }

  async scoreDistributionByBand(
    from: Date,
    to: Date,
  ): Promise<Array<{ band: string; count: number }>> {
    const rows = await this.db
      .select({
        band: matchScoresTable.band,
        count: sql<number>`count(*)::int`,
      })
      .from(matchScoresTable)
      .where(
        and(
          gte(matchScoresTable.createdAt, from),
          lte(matchScoresTable.createdAt, to),
        ),
      )
      .groupBy(matchScoresTable.band);
    return rows;
  }

  /**
   * Last N overrides in range, joined with the recruiter who overrode + the job title.
   * `overriddenAt` is non-null when status='overridden' (set by the override mutation).
   */
  async recentOverrides(
    from: Date,
    to: Date,
    limit: number,
  ): Promise<
    Array<{
      flagId: string;
      term: string;
      category: string;
      jobId: string;
      jobTitle: string;
      overriddenBy: { id: string; fullName: string } | null;
      overrideReason: string;
      overriddenAt: Date;
    }>
  > {
    const rows = await this.db
      .select({
        flag: biasFlagsTable,
        job: jobsTable,
        recruiter: profilesTable,
      })
      .from(biasFlagsTable)
      .innerJoin(jobsTable, eq(jobsTable.id, biasFlagsTable.jobId))
      .leftJoin(profilesTable, eq(profilesTable.id, biasFlagsTable.overriddenBy))
      .where(
        and(
          eq(biasFlagsTable.status, "overridden"),
          gte(biasFlagsTable.overriddenAt, from),
          lte(biasFlagsTable.overriddenAt, to),
        ),
      )
      .orderBy(desc(biasFlagsTable.overriddenAt))
      .limit(limit);

    return rows.map((r) => ({
      flagId: r.flag.id,
      term: r.flag.term,
      category: r.flag.category,
      jobId: r.job.id,
      jobTitle: r.job.title,
      overriddenBy: r.recruiter
        ? { id: r.recruiter.id, fullName: r.recruiter.fullName }
        : null,
      overrideReason: r.flag.overrideReason ?? "(no reason recorded)",
      overriddenAt: r.flag.overriddenAt!,
    }));
  }

  async sampleSize(
    from: Date,
    to: Date,
  ): Promise<{ flags: number; scores: number; jobs: number }> {
    const [flagsRow] = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(biasFlagsTable)
      .where(
        and(
          gte(biasFlagsTable.createdAt, from),
          lte(biasFlagsTable.createdAt, to),
        ),
      );
    const [scoresRow] = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(matchScoresTable)
      .where(
        and(
          gte(matchScoresTable.createdAt, from),
          lte(matchScoresTable.createdAt, to),
        ),
      );
    const [jobsRow] = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.status, "published"),
          gte(jobsTable.createdAt, from),
          lte(jobsTable.createdAt, to),
        ),
      );
    return {
      flags: flagsRow?.c ?? 0,
      scores: scoresRow?.c ?? 0,
      jobs: jobsRow?.c ?? 0,
    };
  }
}
