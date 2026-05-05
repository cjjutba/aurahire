import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  applicationsTable,
  biasFlagsTable,
  jobsTable,
  matchScoresTable,
  profilesTable,
  type Application,
  type NewApplication,
  type MatchScore,
} from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";

@Injectable()
export class ApplicationsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async insert(data: NewApplication): Promise<Application> {
    const [row] = await this.db.insert(applicationsTable).values(data).returning();
    if (!row) throw new Error("Application insert failed");
    return row;
  }

  async update(id: string, patch: Partial<NewApplication>): Promise<Application> {
    const [row] = await this.db
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
      .leftJoin(matchScoresTable, eq(matchScoresTable.applicationId, applicationsTable.id))
      .where(eq(applicationsTable.jobId, jobId))
      .orderBy(
        sql`COALESCE(${matchScoresTable.overallScore}, -1) DESC`,
        desc(applicationsTable.appliedAt),
      );
    return rows.map((r) => ({ ...r.application, matchScore: r.matchScore }));
  }

  async findExisting(candidateId: string, jobId: string): Promise<Application | null> {
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

  async findApplicationContextForRecruiter(
    applicationId: string,
    recruiterId: string,
  ): Promise<Application | null> {
    const [row] = await this.db
      .select({ application: applicationsTable })
      .from(applicationsTable)
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .where(
        and(
          eq(applicationsTable.id, applicationId),
          eq(jobsTable.recruiterId, recruiterId),
        ),
      )
      .limit(1);
    return row?.application ?? null;
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

  // ─── Recruiter dashboard stats ────────────────────────────────────────

  async recruiterStats(
    recruiterId: string,
    range: "7d" | "30d" | "90d" | "all",
  ): Promise<{
    activeJobs: number;
    totalApplications: number;       // alias for totalApps (deprecated, keep for one release)
    totalApps: number;
    pendingReviews: number;          // alias for pendingReview (deprecated, keep for one release)
    pendingReview: number;
    inInterview: number;
    offered: number;
    hired: number;
    avgMatchScore: number;
    biasFlags: number;
  }> {
    const rangeFilter = this.rangeFilter(range);

    const [activeJobsRow] = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.recruiterId, recruiterId),
          eq(jobsTable.status, "published"),
        ),
      );

    const [appsRow] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${applicationsTable.status} = 'applied')::int`,
        interview: sql<number>`count(*) filter (where ${applicationsTable.status} = 'interview')::int`,
        offered: sql<number>`count(*) filter (where ${applicationsTable.status} = 'offer')::int`,
        hired: sql<number>`count(*) filter (where ${applicationsTable.status} = 'hired')::int`,
      })
      .from(applicationsTable)
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .where(
        and(
          eq(jobsTable.recruiterId, recruiterId),
          ...(rangeFilter
            ? [sql`${applicationsTable.appliedAt} >= ${rangeFilter}`]
            : []),
        ),
      );

    const [avgRow] = await this.db
      .select({ avg: sql<number | null>`avg(${matchScoresTable.overallScore})::float` })
      .from(matchScoresTable)
      .innerJoin(jobsTable, eq(jobsTable.id, matchScoresTable.jobId))
      .where(eq(jobsTable.recruiterId, recruiterId));

    const biasFlags = await this.countUnresolvedBiasFlagsForRecruiter(recruiterId);

    const total = appsRow?.total ?? 0;
    const pending = appsRow?.pending ?? 0;

    return {
      activeJobs: activeJobsRow?.c ?? 0,
      totalApplications: total,
      totalApps: total,
      pendingReviews: pending,
      pendingReview: pending,
      inInterview: appsRow?.interview ?? 0,
      offered: appsRow?.offered ?? 0,
      hired: appsRow?.hired ?? 0,
      avgMatchScore: Math.round(avgRow?.avg ?? 0),
      biasFlags,
    };
  }

  private rangeFilter(range: "7d" | "30d" | "90d" | "all"): Date | null {
    if (range === "all") return null;
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  private async countUnresolvedBiasFlagsForRecruiter(
    recruiterId: string,
  ): Promise<number> {
    const [row] = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(biasFlagsTable)
      .innerJoin(jobsTable, eq(jobsTable.id, biasFlagsTable.jobId))
      .where(
        and(
          eq(jobsTable.recruiterId, recruiterId),
          eq(biasFlagsTable.status, "flagged"),
        ),
      );
    return row?.c ?? 0;
  }

  // ─── Recruiter analytics (top jobs + status breakdown) ────────────────

  async recruiterTopJobsByApplications(
    recruiterId: string,
    limit: number,
  ): Promise<Array<{ jobId: string; title: string; status: string; applicationCount: number; avgScore: number }>> {
    const rows = await this.db
      .select({
        jobId: jobsTable.id,
        title: jobsTable.title,
        status: jobsTable.status,
        applicationCount: sql<number>`count(distinct ${applicationsTable.id})::int`,
        avgScore: sql<number | null>`avg(${matchScoresTable.overallScore})::float`,
      })
      .from(jobsTable)
      .leftJoin(applicationsTable, eq(applicationsTable.jobId, jobsTable.id))
      .leftJoin(matchScoresTable, eq(matchScoresTable.jobId, jobsTable.id))
      .where(eq(jobsTable.recruiterId, recruiterId))
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

  async recruiterApplicationsByStatus(
    recruiterId: string,
  ): Promise<Array<{ status: string; count: number }>> {
    const rows = await this.db
      .select({
        status: applicationsTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(applicationsTable)
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .where(eq(jobsTable.recruiterId, recruiterId))
      .groupBy(applicationsTable.status);
    return rows;
  }

  async listRecentForRecruiter(
    recruiterId: string,
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
      .leftJoin(profilesTable, eq(profilesTable.id, applicationsTable.candidateId))
      .leftJoin(matchScoresTable, eq(matchScoresTable.applicationId, applicationsTable.id))
      .where(eq(jobsTable.recruiterId, recruiterId))
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
