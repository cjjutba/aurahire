import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  count,
  desc,
  eq,
  isNotNull,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import * as schema from "@aurahire/db";
import {
  applicationsTable,
  companyMembersTable,
  jobsTable,
  matchScoresTable,
  profilesTable,
  type Application,
  type NewApplication,
  type MatchScore,
} from "@aurahire/db";
import type { ApplicationStatus } from "@aurahire/shared";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";

export type ApplicationsTx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

type Executor = DrizzleClient | ApplicationsTx;

@Injectable()
export class ApplicationsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async insert(data: NewApplication): Promise<Application> {
    const [row] = await this.db
      .insert(applicationsTable)
      .values(data)
      .returning();
    if (!row) throw new Error("Application insert failed");
    return row;
  }

  async update(
    id: string,
    patch: Partial<NewApplication>,
    tx?: ApplicationsTx,
  ): Promise<Application> {
    const exec: Executor = tx ?? this.db;
    const [row] = await exec
      .update(applicationsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(applicationsTable.id, id))
      .returning();
    if (!row) throw new Error("Application update failed");
    return row;
  }

  async findById(id: string): Promise<Application | null> {
    const [row] = await this.db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, id))
      .limit(1);
    return row ?? null;
  }

  /**
   * Lock the row for the duration of the surrounding transaction. Used by
   * the offer accept / decline / hire flows to serialise writers so that
   * the application's status + the latest offer's status stay consistent.
   */
  async findByIdForUpdate(
    tx: ApplicationsTx,
    id: string,
  ): Promise<Application | null> {
    const [row] = await tx
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, id))
      .for("update")
      .limit(1);
    return row ?? null;
  }

  async findByCandidateId(candidateId: string): Promise<Application[]> {
    return this.db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.candidateId, candidateId))
      .orderBy(desc(applicationsTable.appliedAt));
  }

  async findByJobIdSortedByMatchScore(
    jobId: string,
  ): Promise<Array<Application & { matchScore: MatchScore | null }>> {
    const rows = await this.db
      .select({
        application: applicationsTable,
        matchScore: matchScoresTable,
      })
      .from(applicationsTable)
      .leftJoin(
        matchScoresTable,
        eq(matchScoresTable.applicationId, applicationsTable.id),
      )
      .where(eq(applicationsTable.jobId, jobId))
      .orderBy(
        sql`COALESCE(${matchScoresTable.overallScore}, -1) DESC`,
        desc(applicationsTable.appliedAt),
      );
    return rows.map((r) => ({ ...r.application, matchScore: r.matchScore }));
  }

  /**
   * In-flight applications on a job - used by the cascade auto-reject when
   * another candidate is hired. Excludes the just-hired application (passed
   * as `excludeId`) and any already-terminal application.
   */
  async findInflightByJobId(
    tx: ApplicationsTx,
    jobId: string,
    excludeId: string,
  ): Promise<Application[]> {
    return tx
      .select()
      .from(applicationsTable)
      .where(
        and(
          eq(applicationsTable.jobId, jobId),
          ne(applicationsTable.id, excludeId),
          sql`${applicationsTable.status} NOT IN ('hired', 'rejected', 'withdrawn', 'offer_declined')`,
        ),
      );
  }

  /**
   * Count of in-flight applications on a job (excluding the one passed).
   * Used by the recruiter detail view to surface cascade impact in the
   * Hire confirmation modal.
   */
  async countInflightOnJob(jobId: string, excludeId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(applicationsTable)
      .where(
        and(
          eq(applicationsTable.jobId, jobId),
          ne(applicationsTable.id, excludeId),
          sql`${applicationsTable.status} NOT IN ('hired', 'rejected', 'withdrawn', 'offer_declined')`,
        ),
      );
    return Number(row?.value ?? 0);
  }

  async findExisting(
    candidateId: string,
    jobId: string,
  ): Promise<Application | null> {
    const [row] = await this.db
      .select()
      .from(applicationsTable)
      .where(
        and(
          eq(applicationsTable.candidateId, candidateId),
          eq(applicationsTable.jobId, jobId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Phase 2c: company-scoped application lookup. Returns the application
   * row only if it sits under a job owned by `companyId`. Used everywhere
   * the recruiter-side flow asserts "this application belongs to my
   * tenant" - replaces the legacy `findApplicationContextForRecruiter`
   * which keyed on `jobs.recruiter_id` (single-tenant assumption).
   */
  async findApplicationContextForCompany(
    applicationId: string,
    companyId: string,
  ): Promise<Application | null> {
    const [row] = await this.db
      .select({ application: applicationsTable })
      .from(applicationsTable)
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .where(
        and(
          eq(applicationsTable.id, applicationId),
          eq(jobsTable.companyId, companyId),
        ),
      )
      .limit(1);
    return row?.application ?? null;
  }

  /**
   * Returns a minimal context object if the given user is an active member
   * of the company that owns the application's job, else null. Used for
   * authorization on read paths (e.g. ICS download) that cannot require an
   * active-company header because the endpoint must also serve candidates.
   */
  async findApplicationContextForCompanyByUser(
    applicationId: string,
    userId: string,
  ): Promise<{ candidateId: string; jobId: string; companyId: string } | null> {
    const [row] = await this.db
      .select({
        candidateId: applicationsTable.candidateId,
        jobId: applicationsTable.jobId,
        companyId: jobsTable.companyId,
      })
      .from(applicationsTable)
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .innerJoin(
        companyMembersTable,
        and(
          eq(companyMembersTable.companyId, jobsTable.companyId),
          eq(companyMembersTable.userId, userId),
        ),
      )
      .where(eq(applicationsTable.id, applicationId))
      .limit(1);
    return row ?? null;
  }

  async countByJobId(jobId: string): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(applicationsTable)
      .where(eq(applicationsTable.jobId, jobId));
    return rows[0]?.count ?? 0;
  }

  async countByCandidateId(candidateId: string): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(applicationsTable)
      .where(eq(applicationsTable.candidateId, candidateId));
    return rows[0]?.count ?? 0;
  }

  // ─── Company dashboard stats ──────────────────────────────────────────
  // Phase 2c: every recruiter-side aggregate now scopes by `jobs.company_id`
  // instead of `jobs.recruiter_id`. Members of the same company see the
  // same numbers; the recruiter who created the job is no longer special.

  async companyStats(
    companyId: string,
    range: "7d" | "30d" | "90d" | "all",
  ): Promise<{
    activeJobs: number;
    totalApplications: number; // alias for totalApps (deprecated, keep for one release)
    totalApps: number;
    pendingReviews: number; // alias for pendingReview (deprecated, keep for one release)
    pendingReview: number;
    inInterview: number;
    offered: number;
    hired: number;
    avgMatchScore: number;
    biasFlags: number;
  }> {
    const rangeFilter = this.rangeFilter(range);
    // postgres-js wants a string for timestamptz parameter binding; serialize
    // the Date here (mirrors the pattern in admin-stats.repository.ts).
    const rangeFilterIso = rangeFilter ? rangeFilter.toISOString() : null;

    // Single roundtrip: four independent CTEs evaluated by the planner in one
    // query, replacing four sequential SELECTs. Numbers are identical to the
    // prior implementation; the only difference is the wire-trip count.
    const result = await this.db.execute<{
      active_jobs: number;
      total: number;
      pending: number;
      interview: number;
      offered: number;
      hired: number;
      avg_score: number | null;
      bias_flags: number;
    }>(sql`
      WITH
        active_jobs AS (
          SELECT COUNT(*)::int AS c
          FROM jobs
          WHERE company_id = ${companyId}::uuid
            AND status = 'published'
        ),
        apps_stats AS (
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE a.status = 'applied')::int AS pending,
            COUNT(*) FILTER (WHERE a.status = 'interview')::int AS interview,
            COUNT(*) FILTER (WHERE a.status = 'offer')::int AS offered,
            COUNT(*) FILTER (WHERE a.status = 'hired')::int AS hired
          FROM applications a
          INNER JOIN jobs j ON j.id = a.job_id
          WHERE j.company_id = ${companyId}::uuid
            AND (${rangeFilterIso}::timestamptz IS NULL OR a.applied_at >= ${rangeFilterIso}::timestamptz)
        ),
        avg_score AS (
          SELECT AVG(ms.overall_score)::float AS avg_score
          FROM match_scores ms
          INNER JOIN jobs j ON j.id = ms.job_id
          WHERE j.company_id = ${companyId}::uuid
        ),
        bias_flags AS (
          SELECT COUNT(*)::int AS c
          FROM bias_flags bf
          INNER JOIN jobs j ON j.id = bf.job_id
          WHERE j.company_id = ${companyId}::uuid
            AND bf.status = 'flagged'
        )
      SELECT
        active_jobs.c AS active_jobs,
        apps_stats.total,
        apps_stats.pending,
        apps_stats.interview,
        apps_stats.offered,
        apps_stats.hired,
        avg_score.avg_score,
        bias_flags.c AS bias_flags
      FROM active_jobs, apps_stats, avg_score, bias_flags
    `);

    // Drizzle's postgres-js wrapper returns rows directly as the awaited array
    // (matches the pattern in admin-stats.repository.ts: `result[0]`).
    const row = (
      result as Array<{
        active_jobs: number;
        total: number;
        pending: number;
        interview: number;
        offered: number;
        hired: number;
        avg_score: number | null;
        bias_flags: number;
      }>
    )[0];

    if (!row) {
      return {
        activeJobs: 0,
        totalApplications: 0,
        totalApps: 0,
        pendingReviews: 0,
        pendingReview: 0,
        inInterview: 0,
        offered: 0,
        hired: 0,
        avgMatchScore: 0,
        biasFlags: 0,
      };
    }

    const total = Number(row.total ?? 0);
    const pending = Number(row.pending ?? 0);

    return {
      activeJobs: Number(row.active_jobs ?? 0),
      totalApplications: total,
      totalApps: total,
      pendingReviews: pending,
      pendingReview: pending,
      inInterview: Number(row.interview ?? 0),
      offered: Number(row.offered ?? 0),
      hired: Number(row.hired ?? 0),
      avgMatchScore: Math.round(Number(row.avg_score ?? 0)),
      biasFlags: Number(row.bias_flags ?? 0),
    };
  }

  private rangeFilter(range: "7d" | "30d" | "90d" | "all"): Date | null {
    if (range === "all") return null;
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  // ─── Company analytics (top jobs + status breakdown) ──────────────────

  async companyTopJobsByApplications(
    companyId: string,
    limit: number,
  ): Promise<
    Array<{
      jobId: string;
      title: string;
      status: string;
      applicationCount: number;
      avgScore: number;
    }>
  > {
    const rows = await this.db
      .select({
        jobId: jobsTable.id,
        title: jobsTable.title,
        status: jobsTable.status,
        applicationCount: sql<number>`count(distinct ${applicationsTable.id})::int`,
        avgScore: sql<
          number | null
        >`avg(${matchScoresTable.overallScore})::float`,
      })
      .from(jobsTable)
      .leftJoin(applicationsTable, eq(applicationsTable.jobId, jobsTable.id))
      .leftJoin(matchScoresTable, eq(matchScoresTable.jobId, jobsTable.id))
      .where(eq(jobsTable.companyId, companyId))
      .groupBy(jobsTable.id, jobsTable.title, jobsTable.status)
      .orderBy(desc(sql<number>`count(distinct ${applicationsTable.id})`))
      .limit(limit);
    return rows.map((r) => ({
      jobId: r.jobId,
      title: r.title,
      status: r.status,
      applicationCount: r.applicationCount,
      avgScore: Math.round(r.avgScore ?? 0),
    }));
  }

  async companyApplicationsByStatus(
    companyId: string,
  ): Promise<Array<{ status: string; count: number }>> {
    const rows = await this.db
      .select({
        status: applicationsTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(applicationsTable)
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .where(eq(jobsTable.companyId, companyId))
      .groupBy(applicationsTable.status);
    return rows;
  }

  async setShortlistedAt(
    applicationId: string,
    value: Date | null,
  ): Promise<Application> {
    const [row] = await this.db
      .update(applicationsTable)
      .set({ shortlistedAt: value, updatedAt: new Date() })
      .where(eq(applicationsTable.id, applicationId))
      .returning();
    if (!row) throw new Error("Application update failed");
    return row;
  }

  async listShortlistedForCompany(
    companyId: string,
    options: {
      page: number;
      limit: number;
      q?: string;
      status?: ApplicationStatus;
      jobId?: string;
      band?: "strong" | "partial" | "limited";
      sort: "recently-shortlisted" | "highest-score" | "earliest-applied";
    },
  ): Promise<{
    rows: Array<
      Application & {
        matchScore: MatchScore | null;
        candidateFullName: string | null;
        candidateEmail: string | null;
        jobTitle: string | null;
      }
    >;
    total: number;
  }> {
    const conditions: SQL[] = [
      eq(jobsTable.companyId, companyId),
      isNotNull(applicationsTable.shortlistedAt),
    ];
    if (options.status) {
      conditions.push(eq(applicationsTable.status, options.status));
    }
    if (options.jobId) {
      conditions.push(eq(applicationsTable.jobId, options.jobId));
    }
    if (options.band) {
      conditions.push(eq(matchScoresTable.band, options.band));
    }
    if (options.q && options.q.trim()) {
      const term = `%${options.q.trim().toLowerCase()}%`;
      conditions.push(
        sql`(lower(${profilesTable.fullName}) like ${term} or lower(${jobsTable.title}) like ${term})`,
      );
    }
    const where = conditions.length === 1 ? conditions[0] : and(...conditions);

    const countRows = await this.db
      .select({ count: count() })
      .from(applicationsTable)
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .leftJoin(
        matchScoresTable,
        eq(matchScoresTable.applicationId, applicationsTable.id),
      )
      .leftJoin(
        profilesTable,
        eq(profilesTable.id, applicationsTable.candidateId),
      )
      .where(where);
    const total = countRows[0]?.count ?? 0;

    let orderClause: SQL;
    switch (options.sort) {
      case "highest-score":
        orderClause = sql`coalesce(${matchScoresTable.overallScore}, -1) desc, ${applicationsTable.shortlistedAt} desc`;
        break;
      case "earliest-applied":
        orderClause = sql`${applicationsTable.appliedAt} asc`;
        break;
      case "recently-shortlisted":
      default:
        orderClause = sql`${applicationsTable.shortlistedAt} desc`;
        break;
    }

    const rows = await this.db
      .select({
        application: applicationsTable,
        matchScore: matchScoresTable,
        candidateFullName: profilesTable.fullName,
        candidateEmail: profilesTable.email,
        jobTitle: jobsTable.title,
      })
      .from(applicationsTable)
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .leftJoin(
        matchScoresTable,
        eq(matchScoresTable.applicationId, applicationsTable.id),
      )
      .leftJoin(
        profilesTable,
        eq(profilesTable.id, applicationsTable.candidateId),
      )
      .where(where)
      .orderBy(orderClause)
      .limit(options.limit)
      .offset((options.page - 1) * options.limit);

    return {
      rows: rows.map((r) => ({
        ...r.application,
        matchScore: r.matchScore,
        candidateFullName: r.candidateFullName,
        candidateEmail: r.candidateEmail,
        jobTitle: r.jobTitle,
      })),
      total: Number(total),
    };
  }

  async listAllForCompany(
    companyId: string,
    options: {
      page: number;
      limit: number;
      q?: string;
      status?: ApplicationStatus;
      jobId?: string;
      band?: "strong" | "partial" | "limited";
      sort: "recent" | "oldest" | "score-high";
    },
  ): Promise<{
    rows: Array<
      Application & {
        matchScore: MatchScore | null;
        candidateFullName: string | null;
        candidateEmail: string | null;
        jobTitle: string | null;
      }
    >;
    total: number;
  }> {
    const conditions: SQL[] = [eq(jobsTable.companyId, companyId)];
    if (options.status) {
      conditions.push(eq(applicationsTable.status, options.status));
    }
    if (options.jobId) {
      conditions.push(eq(applicationsTable.jobId, options.jobId));
    }
    if (options.band) {
      conditions.push(eq(matchScoresTable.band, options.band));
    }
    if (options.q && options.q.trim()) {
      const term = `%${options.q.trim().toLowerCase()}%`;
      conditions.push(
        sql`(lower(${profilesTable.fullName}) like ${term} or lower(${jobsTable.title}) like ${term})`,
      );
    }
    const where = conditions.length === 1 ? conditions[0] : and(...conditions);

    const countRows = await this.db
      .select({ count: count() })
      .from(applicationsTable)
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .leftJoin(
        matchScoresTable,
        eq(matchScoresTable.applicationId, applicationsTable.id),
      )
      .leftJoin(
        profilesTable,
        eq(profilesTable.id, applicationsTable.candidateId),
      )
      .where(where);
    const total = countRows[0]?.count ?? 0;

    let orderClause: SQL;
    switch (options.sort) {
      case "score-high":
        orderClause = sql`coalesce(${matchScoresTable.overallScore}, -1) desc, ${applicationsTable.appliedAt} desc`;
        break;
      case "oldest":
        orderClause = sql`${applicationsTable.appliedAt} asc`;
        break;
      case "recent":
      default:
        orderClause = sql`${applicationsTable.appliedAt} desc`;
        break;
    }

    const rows = await this.db
      .select({
        application: applicationsTable,
        matchScore: matchScoresTable,
        candidateFullName: profilesTable.fullName,
        candidateEmail: profilesTable.email,
        jobTitle: jobsTable.title,
      })
      .from(applicationsTable)
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .leftJoin(
        matchScoresTable,
        eq(matchScoresTable.applicationId, applicationsTable.id),
      )
      .leftJoin(
        profilesTable,
        eq(profilesTable.id, applicationsTable.candidateId),
      )
      .where(where)
      .orderBy(orderClause)
      .limit(options.limit)
      .offset((options.page - 1) * options.limit);

    return {
      rows: rows.map((r) => ({
        ...r.application,
        matchScore: r.matchScore,
        candidateFullName: r.candidateFullName,
        candidateEmail: r.candidateEmail,
        jobTitle: r.jobTitle,
      })),
      total: Number(total),
    };
  }

  async listRecentForCompany(
    companyId: string,
    limit: number,
  ): Promise<
    Array<
      Application & {
        matchScore: MatchScore | null;
        candidateFullName: string | null;
        candidateEmail: string | null;
        jobTitle: string | null;
      }
    >
  > {
    const rows = await this.db
      .select({
        application: applicationsTable,
        matchScore: matchScoresTable,
        candidateFullName: profilesTable.fullName,
        candidateEmail: profilesTable.email,
        jobTitle: jobsTable.title,
      })
      .from(applicationsTable)
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .leftJoin(
        profilesTable,
        eq(profilesTable.id, applicationsTable.candidateId),
      )
      .leftJoin(
        matchScoresTable,
        eq(matchScoresTable.applicationId, applicationsTable.id),
      )
      .where(eq(jobsTable.companyId, companyId))
      .orderBy(desc(applicationsTable.appliedAt))
      .limit(limit);
    return rows.map((r) => ({
      ...r.application,
      matchScore: r.matchScore,
      candidateFullName: r.candidateFullName,
      candidateEmail: r.candidateEmail,
      jobTitle: r.jobTitle,
    }));
  }
}
