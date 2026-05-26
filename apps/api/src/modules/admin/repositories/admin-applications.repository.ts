import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  between,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  applicationsTable,
  auditLogsTable,
  companiesTable,
  evidenceExcerptsTable,
  jobsTable,
  matchScoresTable,
  profilesTable,
  resumesTable,
  type Application,
  type EvidenceExcerpt,
  type Job,
  type MatchScore,
  type Profile,
  type Resume,
} from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../../db/db.module";

export interface ListAdminApplicationsFilters {
  jobId?: string;
  candidateId?: string;
  status?:
    | "applied"
    | "interview"
    | "offer"
    | "offer_accepted"
    | "offer_declined"
    | "hired"
    | "rejected"
    | "withdrawn";
  minScore?: number;
  maxScore?: number;
  dateFrom?: Date;
  dateTo?: Date;
  q?: string;
  page: number;
  limit: number;
}

export interface AdminApplicationListJoinedRow {
  application: Application;
  candidate: Profile;
  job: Job;
  company: { id: string; name: string };
  recruiter: { id: string; fullName: string };
  matchScore: MatchScore | null;
}

@Injectable()
export class AdminApplicationsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async list(filters: ListAdminApplicationsFilters): Promise<{
    rows: AdminApplicationListJoinedRow[];
    total: number;
  }> {
    const offset = (filters.page - 1) * filters.limit;

    // Recruiter join needs an aliased profiles table to disambiguate from
    // candidate. Sprint-acceptable workaround: batch-load recruiter names in a
    // second query against the visible page (≤ 20 rows).
    const conditions: SQL[] = [];
    if (filters.jobId)
      conditions.push(eq(applicationsTable.jobId, filters.jobId));
    if (filters.candidateId)
      conditions.push(eq(applicationsTable.candidateId, filters.candidateId));
    if (filters.status)
      conditions.push(eq(applicationsTable.status, filters.status));
    if (filters.dateFrom)
      conditions.push(gte(applicationsTable.appliedAt, filters.dateFrom));
    if (filters.dateTo)
      conditions.push(lte(applicationsTable.appliedAt, filters.dateTo));

    if (filters.minScore !== undefined && filters.maxScore !== undefined) {
      conditions.push(
        between(
          matchScoresTable.overallScore,
          filters.minScore,
          filters.maxScore,
        ),
      );
    } else if (filters.minScore !== undefined) {
      conditions.push(gte(matchScoresTable.overallScore, filters.minScore));
    } else if (filters.maxScore !== undefined) {
      conditions.push(lte(matchScoresTable.overallScore, filters.maxScore));
    }

    if (filters.q) {
      const pattern = `%${filters.q}%`;
      const orClause = or(
        ilike(profilesTable.fullName, pattern),
        ilike(profilesTable.email, pattern),
      );
      if (orClause) conditions.push(orClause);
    }

    const where =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : and(...conditions);

    const rows = await this.db
      .select({
        application: applicationsTable,
        candidate: profilesTable,
        job: jobsTable,
        company: companiesTable,
        matchScore: matchScoresTable,
      })
      .from(applicationsTable)
      .innerJoin(
        profilesTable,
        eq(profilesTable.id, applicationsTable.candidateId),
      )
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .innerJoin(companiesTable, eq(companiesTable.id, jobsTable.companyId))
      .leftJoin(
        matchScoresTable,
        eq(matchScoresTable.applicationId, applicationsTable.id),
      )
      .where(where)
      .orderBy(desc(applicationsTable.appliedAt))
      .limit(filters.limit)
      .offset(offset);

    const totalRows = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(applicationsTable)
      .innerJoin(
        profilesTable,
        eq(profilesTable.id, applicationsTable.candidateId),
      )
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .leftJoin(
        matchScoresTable,
        eq(matchScoresTable.applicationId, applicationsTable.id),
      )
      .where(where);

    // Batch-load recruiter names for the visible page (avoids alias dance).
    const recruiterIds = Array.from(
      new Set(rows.map((r) => r.job.recruiterId)),
    );
    const recruiters =
      recruiterIds.length > 0
        ? await this.db
            .select({
              id: profilesTable.id,
              fullName: profilesTable.fullName,
            })
            .from(profilesTable)
            .where(inArray(profilesTable.id, recruiterIds))
        : [];
    const recruiterById = new Map(recruiters.map((r) => [r.id, r]));

    return {
      rows: rows.map((r) => ({
        application: r.application,
        candidate: r.candidate,
        job: r.job,
        company: { id: r.company.id, name: r.company.name },
        recruiter: {
          id: r.job.recruiterId,
          fullName:
            recruiterById.get(r.job.recruiterId)?.fullName ?? "(unknown)",
        },
        matchScore: r.matchScore ?? null,
      })),
      total: totalRows[0]?.c ?? 0,
    };
  }

  async findApplication(id: string): Promise<Application | null> {
    const [row] = await this.db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, id))
      .limit(1);
    return row ?? null;
  }

  async findCandidateProfile(candidateId: string): Promise<{
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
  } | null> {
    const [row] = await this.db
      .select({
        id: profilesTable.id,
        fullName: profilesTable.fullName,
        email: profilesTable.email,
        phone: profilesTable.phone,
      })
      .from(profilesTable)
      .where(eq(profilesTable.id, candidateId))
      .limit(1);
    return row ?? null;
  }

  async findJobWithCompanyAndRecruiter(jobId: string): Promise<
    | (Job & {
        company: { id: string; name: string };
        recruiter: { id: string; fullName: string; email: string };
      })
    | null
  > {
    const [row] = await this.db
      .select({
        job: jobsTable,
        company: companiesTable,
        recruiter: profilesTable,
      })
      .from(jobsTable)
      .innerJoin(companiesTable, eq(companiesTable.id, jobsTable.companyId))
      .innerJoin(profilesTable, eq(profilesTable.id, jobsTable.recruiterId))
      .where(eq(jobsTable.id, jobId))
      .limit(1);
    return row
      ? {
          ...row.job,
          company: { id: row.company.id, name: row.company.name },
          recruiter: {
            id: row.recruiter.id,
            fullName: row.recruiter.fullName,
            email: row.recruiter.email,
          },
        }
      : null;
  }

  async findResume(resumeId: string): Promise<Resume | null> {
    const [row] = await this.db
      .select()
      .from(resumesTable)
      .where(eq(resumesTable.id, resumeId))
      .limit(1);
    return row ?? null;
  }

  async findMatchScoreByApplicationId(
    applicationId: string,
  ): Promise<{ score: MatchScore; evidence: EvidenceExcerpt[] } | null> {
    const [scoreRow] = await this.db
      .select()
      .from(matchScoresTable)
      .where(eq(matchScoresTable.applicationId, applicationId))
      .limit(1);
    if (!scoreRow) return null;

    const evidence = await this.db
      .select()
      .from(evidenceExcerptsTable)
      .where(
        and(
          eq(evidenceExcerptsTable.scoreType, "match"),
          eq(evidenceExcerptsTable.scoreId, scoreRow.id),
        ),
      )
      .orderBy(asc(evidenceExcerptsTable.componentName));

    return { score: scoreRow, evidence };
  }

  /**
   * Audit trail: rows where entity_type='application' AND entity_id=applicationId
   * UNION rows where entity_type='match_score' AND entity_id=matchScoreId.
   * Sprint-acceptable: two queries combined in JS (UNION ALL via Drizzle is awkward).
   */
  async findAuditTrail(
    applicationId: string,
    matchScoreId: string | null,
  ): Promise<
    Array<{
      id: string;
      action: string;
      actorType: string;
      actorId: string | null;
      entityType: string;
      entityId: string;
      details: Record<string, unknown> | null;
      createdAt: Date;
    }>
  > {
    const applicationRows = await this.db
      .select()
      .from(auditLogsTable)
      .where(
        and(
          eq(auditLogsTable.entityType, "application"),
          eq(auditLogsTable.entityId, applicationId),
        ),
      );

    const scoreRows = matchScoreId
      ? await this.db
          .select()
          .from(auditLogsTable)
          .where(
            and(
              eq(auditLogsTable.entityType, "match_score"),
              eq(auditLogsTable.entityId, matchScoreId),
            ),
          )
      : [];

    const all = [...applicationRows, ...scoreRows].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    return all.map((r) => ({
      id: r.id,
      action: r.action,
      actorType: r.actorType,
      actorId: r.actorId,
      entityType: r.entityType,
      entityId: r.entityId,
      details: (r.details as Record<string, unknown>) ?? null,
      createdAt: r.createdAt,
    }));
  }
}
