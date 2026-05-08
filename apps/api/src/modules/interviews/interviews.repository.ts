import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import {
  applicationsTable,
  companiesTable,
  interviewsTable,
  jobsTable,
  profilesTable,
  type Interview,
  type NewInterview,
} from "@aurahire/db";
import type { InterviewFormat, InterviewStatus } from "@aurahire/shared";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";

export interface RecruiterInterviewRow extends Interview {
  candidateId: string | null;
  candidateFullName: string | null;
  candidateEmail: string | null;
  jobId: string | null;
  jobTitle: string | null;
}

export interface CandidateInterviewRow extends Interview {
  jobId: string | null;
  jobTitle: string | null;
  companyId: string | null;
  companyName: string | null;
  companyLogoUrl: string | null;
}

export interface RecruiterInterviewsQuery {
  page: number;
  limit: number;
  q?: string;
  status?: InterviewStatus;
  format?: InterviewFormat;
  sort: "upcoming" | "recent" | "earliest";
}

@Injectable()
export class InterviewsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async insert(data: NewInterview): Promise<Interview> {
    const [row] = await this.db.insert(interviewsTable).values(data).returning();
    if (!row) throw new Error("Interview insert failed");
    return row;
  }

  async findById(id: string): Promise<Interview | null> {
    const [row] = await this.db
      .select()
      .from(interviewsTable)
      .where(eq(interviewsTable.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByApplicationId(applicationId: string): Promise<Interview[]> {
    return this.db
      .select()
      .from(interviewsTable)
      .where(eq(interviewsTable.applicationId, applicationId))
      .orderBy(desc(interviewsTable.scheduledAt));
  }

  async findByCandidateId(
    candidateId: string,
  ): Promise<CandidateInterviewRow[]> {
    const rows = await this.db
      .select({
        interview: interviewsTable,
        jobId: jobsTable.id,
        jobTitle: jobsTable.title,
        companyId: companiesTable.id,
        companyName: companiesTable.name,
        companyLogoUrl: companiesTable.logoUrl,
      })
      .from(interviewsTable)
      .innerJoin(applicationsTable, eq(applicationsTable.id, interviewsTable.applicationId))
      .leftJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .leftJoin(companiesTable, eq(companiesTable.id, jobsTable.companyId))
      .where(eq(applicationsTable.candidateId, candidateId))
      .orderBy(desc(interviewsTable.scheduledAt));
    return rows.map((r) => ({
      ...r.interview,
      jobId: r.jobId,
      jobTitle: r.jobTitle,
      companyId: r.companyId,
      companyName: r.companyName,
      companyLogoUrl: r.companyLogoUrl,
    }));
  }

  async listForCompanyPaginated(
    companyId: string,
    options: RecruiterInterviewsQuery,
  ): Promise<{ rows: RecruiterInterviewRow[]; total: number }> {
    const conditions: SQL[] = [eq(jobsTable.companyId, companyId)];
    if (options.status) {
      conditions.push(eq(interviewsTable.status, options.status));
    }
    if (options.format) {
      conditions.push(eq(interviewsTable.format, options.format));
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
      .from(interviewsTable)
      .innerJoin(applicationsTable, eq(applicationsTable.id, interviewsTable.applicationId))
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .leftJoin(profilesTable, eq(profilesTable.id, applicationsTable.candidateId))
      .where(where);
    const total = countRows[0]?.count ?? 0;

    let orderClause: SQL;
    switch (options.sort) {
      case "earliest":
        orderClause = sql`${interviewsTable.scheduledAt} asc`;
        break;
      case "recent":
        orderClause = sql`${interviewsTable.createdAt} desc`;
        break;
      case "upcoming":
      default:
        orderClause = sql`(${interviewsTable.scheduledAt} >= now()) desc, ${interviewsTable.scheduledAt} asc`;
        break;
    }

    const rows = await this.db
      .select({
        interview: interviewsTable,
        candidateId: applicationsTable.candidateId,
        candidateFullName: profilesTable.fullName,
        candidateEmail: profilesTable.email,
        jobId: jobsTable.id,
        jobTitle: jobsTable.title,
      })
      .from(interviewsTable)
      .innerJoin(applicationsTable, eq(applicationsTable.id, interviewsTable.applicationId))
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .leftJoin(profilesTable, eq(profilesTable.id, applicationsTable.candidateId))
      .where(where)
      .orderBy(orderClause)
      .limit(options.limit)
      .offset((options.page - 1) * options.limit);

    return {
      rows: rows.map((r) => ({
        ...r.interview,
        candidateId: r.candidateId,
        candidateFullName: r.candidateFullName,
        candidateEmail: r.candidateEmail,
        jobId: r.jobId,
        jobTitle: r.jobTitle,
      })),
      total: Number(total),
    };
  }

  async update(id: string, patch: Partial<NewInterview>): Promise<Interview> {
    const [row] = await this.db
      .update(interviewsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(interviewsTable.id, id))
      .returning();
    if (!row) throw new Error("Interview update failed");
    return row;
  }

  async markRescheduled(id: string, tx?: DrizzleClient): Promise<{ id: string } | null> {
    const client = tx ?? this.db;
    const [row] = await client
      .update(interviewsTable)
      .set({ status: "rescheduled", updatedAt: new Date() })
      .where(
        and(
          eq(interviewsTable.id, id),
          inArray(interviewsTable.status, ["scheduled", "no-show"]),
        ),
      )
      .returning({ id: interviewsTable.id });
    return row ?? null;
  }

  async setRescheduledTo(originalId: string, newId: string, tx?: DrizzleClient): Promise<void> {
    const client = tx ?? this.db;
    await client
      .update(interviewsTable)
      .set({ rescheduledToId: newId, updatedAt: new Date() })
      .where(eq(interviewsTable.id, originalId));
  }

  async findOverlapping(args: {
    startsAt: Date;
    endsAt: Date;
    recruiterId?: string;
    candidateId?: string;
    excludeInterviewId?: string;
  }): Promise<
    Array<{
      id: string;
      applicationId: string;
      scheduledAt: Date;
      durationMinutes: number;
      scheduledBy: string;
    }>
  > {
    const conditions: SQL[] = [
      eq(interviewsTable.status, "scheduled"),
      sql`(
        ${interviewsTable.scheduledAt} < ${args.endsAt.toISOString()}::timestamptz
        AND (${interviewsTable.scheduledAt} + (${interviewsTable.durationMinutes} || ' minutes')::interval)
            > ${args.startsAt.toISOString()}::timestamptz
      )`,
    ];
    if (args.excludeInterviewId) {
      conditions.push(ne(interviewsTable.id, args.excludeInterviewId));
    }

    if (args.recruiterId && !args.candidateId) {
      conditions.push(eq(interviewsTable.scheduledBy, args.recruiterId));
      return this.db
        .select({
          id: interviewsTable.id,
          applicationId: interviewsTable.applicationId,
          scheduledAt: interviewsTable.scheduledAt,
          durationMinutes: interviewsTable.durationMinutes,
          scheduledBy: interviewsTable.scheduledBy,
        })
        .from(interviewsTable)
        .where(and(...conditions));
    }
    if (args.candidateId && !args.recruiterId) {
      return this.db
        .select({
          id: interviewsTable.id,
          applicationId: interviewsTable.applicationId,
          scheduledAt: interviewsTable.scheduledAt,
          durationMinutes: interviewsTable.durationMinutes,
          scheduledBy: interviewsTable.scheduledBy,
        })
        .from(interviewsTable)
        .innerJoin(applicationsTable, eq(applicationsTable.id, interviewsTable.applicationId))
        .where(and(...conditions, eq(applicationsTable.candidateId, args.candidateId)));
    }
    // No filter combination supplied — return empty rather than scanning all interviews.
    return [];
  }
}
