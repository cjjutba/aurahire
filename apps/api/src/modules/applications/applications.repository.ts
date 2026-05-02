import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  applicationsTable,
  jobsTable,
  matchScoresTable,
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
}
