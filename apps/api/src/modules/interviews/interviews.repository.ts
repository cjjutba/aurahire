import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import {
  applicationsTable,
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

  async findByCandidateId(candidateId: string): Promise<Interview[]> {
    const rows = await this.db
      .select({ interview: interviewsTable })
      .from(interviewsTable)
      .innerJoin(applicationsTable, eq(applicationsTable.id, interviewsTable.applicationId))
      .where(eq(applicationsTable.candidateId, candidateId))
      .orderBy(desc(interviewsTable.scheduledAt));
    return rows.map((r) => r.interview);
  }

  async listForRecruiterPaginated(
    recruiterId: string,
    options: RecruiterInterviewsQuery,
  ): Promise<{ rows: RecruiterInterviewRow[]; total: number }> {
    const conditions: SQL[] = [eq(jobsTable.recruiterId, recruiterId)];
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
}
