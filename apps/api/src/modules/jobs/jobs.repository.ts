import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  biasFlagsTable,
  jobsTable,
  companiesTable,
  profilesTable,
  type Job,
  type NewJob,
  type Company,
  type JobStatus,
  type WorkMode,
  type ExperienceLevel,
} from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";

export interface JobWithCompany extends Job {
  company: Company;
}

export interface JobRecruiter {
  id: string;
  fullName: string;
  email: string;
}

export interface JobWithCompanyAndRecruiter extends JobWithCompany {
  recruiter: JobRecruiter;
}

export interface ListJobsForAdminFilters {
  status?: JobStatus;
  recruiterId?: string;
  hasBiasFlags?: boolean;
  q?: string;
  page: number;
  limit: number;
}

export interface ListJobsFilters {
  q?: string;
  mode?: WorkMode;
  experienceLevel?: ExperienceLevel;
  locationCountry?: string;
  status?: JobStatus | JobStatus[];
  recruiterId?: string;
  sort?: "recent" | "best-match" | "salary-high";
  page: number;
  limit: number;
}

@Injectable()
export class JobsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async insert(data: NewJob): Promise<Job> {
    const [row] = await this.db.insert(jobsTable).values(data).returning();
    if (!row) throw new Error("Job insert failed");
    return row;
  }

  async update(id: string, patch: Partial<NewJob>): Promise<Job> {
    const [row] = await this.db
      .update(jobsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(jobsTable.id, id))
      .returning();
    if (!row) throw new Error("Job update failed");
    return row;
  }

  async findById(id: string): Promise<Job | null> {
    const [row] = await this.db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByIdWithCompany(id: string): Promise<JobWithCompany | null> {
    const [row] = await this.db
      .select({ job: jobsTable, company: companiesTable })
      .from(jobsTable)
      .leftJoin(companiesTable, eq(companiesTable.id, jobsTable.companyId))
      .where(eq(jobsTable.id, id))
      .limit(1);
    if (!row || !row.company) return null;
    return { ...row.job, company: row.company };
  }

  async list(filters: ListJobsFilters): Promise<{ rows: JobWithCompany[]; total: number }> {
    const where = this.buildWhere(filters);
    const orderBy = this.buildOrder(filters.sort);
    const offset = (filters.page - 1) * filters.limit;

    const [rows, totalResult] = await Promise.all([
      this.db
        .select({ job: jobsTable, company: companiesTable })
        .from(jobsTable)
        .leftJoin(companiesTable, eq(companiesTable.id, jobsTable.companyId))
        .where(where)
        .orderBy(orderBy)
        .limit(filters.limit)
        .offset(offset),
      this.db.select({ count: count() }).from(jobsTable).where(where),
    ]);

    return {
      rows: rows
        .filter((r) => r.company != null)
        .map((r) => ({ ...r.job, company: r.company! })),
      total: Number(totalResult[0]?.count ?? 0),
    };
  }

  async findByIdWithCompanyAndRecruiter(
    id: string,
  ): Promise<JobWithCompanyAndRecruiter | null> {
    const [row] = await this.db
      .select({
        job: jobsTable,
        company: companiesTable,
        recruiter: profilesTable,
      })
      .from(jobsTable)
      .leftJoin(companiesTable, eq(companiesTable.id, jobsTable.companyId))
      .leftJoin(profilesTable, eq(profilesTable.id, jobsTable.recruiterId))
      .where(eq(jobsTable.id, id))
      .limit(1);
    if (!row || !row.company || !row.recruiter) return null;
    return {
      ...row.job,
      company: row.company,
      recruiter: {
        id: row.recruiter.id,
        fullName: row.recruiter.fullName,
        email: row.recruiter.email,
      },
    };
  }

  async listForAdmin(filters: ListJobsForAdminFilters): Promise<{
    rows: JobWithCompanyAndRecruiter[];
    total: number;
  }> {
    const offset = (filters.page - 1) * filters.limit;
    const conditions: SQL[] = [];
    if (filters.status) conditions.push(eq(jobsTable.status, filters.status));
    if (filters.recruiterId)
      conditions.push(eq(jobsTable.recruiterId, filters.recruiterId));
    if (filters.q) {
      const pattern = `%${filters.q}%`;
      const orClause = or(
        ilike(jobsTable.title, pattern),
        ilike(jobsTable.descriptionPlain, pattern),
      );
      if (orClause) conditions.push(orClause);
    }
    if (filters.hasBiasFlags) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM ${biasFlagsTable} WHERE ${biasFlagsTable.jobId} = ${jobsTable.id})`,
      );
    }
    const where =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : and(...conditions);

    const [rows, totalResult] = await Promise.all([
      this.db
        .select({
          job: jobsTable,
          company: companiesTable,
          recruiter: profilesTable,
        })
        .from(jobsTable)
        .leftJoin(companiesTable, eq(companiesTable.id, jobsTable.companyId))
        .leftJoin(profilesTable, eq(profilesTable.id, jobsTable.recruiterId))
        .where(where)
        .orderBy(desc(jobsTable.createdAt))
        .limit(filters.limit)
        .offset(offset),
      this.db.select({ count: count() }).from(jobsTable).where(where),
    ]);

    return {
      rows: rows
        .filter((r) => r.company != null && r.recruiter != null)
        .map((r) => ({
          ...r.job,
          company: r.company!,
          recruiter: {
            id: r.recruiter!.id,
            fullName: r.recruiter!.fullName,
            email: r.recruiter!.email,
          },
        })),
      total: Number(totalResult[0]?.count ?? 0),
    };
  }

  async incrementViewCount(id: string): Promise<void> {
    // Atomic increment via SQL expression — avoids read-then-write races.
    await this.db
      .update(jobsTable)
      .set({
        viewCount: sql`${jobsTable.viewCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(jobsTable.id, id));
  }

  // ----- private helpers -----

  private buildWhere(filters: ListJobsFilters): SQL | undefined {
    const conditions: SQL[] = [];

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(eq(jobsTable.status, filters.status[0]!));
      } else {
        conditions.push(eq(jobsTable.status, filters.status));
      }
    }

    if (filters.recruiterId) {
      conditions.push(eq(jobsTable.recruiterId, filters.recruiterId));
    }

    if (filters.q) {
      const pattern = `%${filters.q}%`;
      const titleMatch = ilike(jobsTable.title, pattern);
      const descMatch = ilike(jobsTable.descriptionPlain, pattern);
      const orClause = or(titleMatch, descMatch);
      if (orClause) conditions.push(orClause);
    }

    if (filters.mode) {
      conditions.push(eq(jobsTable.workMode, filters.mode));
    }

    if (filters.experienceLevel) {
      conditions.push(eq(jobsTable.experienceLevel, filters.experienceLevel));
    }

    if (filters.locationCountry) {
      conditions.push(eq(jobsTable.locationCountry, filters.locationCountry));
    }

    if (conditions.length === 0) return undefined;
    if (conditions.length === 1) return conditions[0];
    return and(...conditions);
  }

  private buildOrder(sort?: "recent" | "best-match" | "salary-high") {
    switch (sort) {
      case "salary-high":
        return desc(jobsTable.salaryMax);
      case "best-match":
        // No match score yet (Slice 2.6); fall through to recent.
        return desc(jobsTable.publishedAt);
      case "recent":
      default:
        return desc(jobsTable.publishedAt);
    }
  }
}
