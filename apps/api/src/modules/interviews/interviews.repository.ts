import { Inject, Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import {
  applicationsTable,
  interviewsTable,
  jobsTable,
  type Interview,
  type NewInterview,
} from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";

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

  async findByRecruiterId(recruiterId: string): Promise<Interview[]> {
    const rows = await this.db
      .select({ interview: interviewsTable })
      .from(interviewsTable)
      .innerJoin(applicationsTable, eq(applicationsTable.id, interviewsTable.applicationId))
      .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
      .where(eq(jobsTable.recruiterId, recruiterId))
      .orderBy(desc(interviewsTable.scheduledAt));
    return rows.map((r) => r.interview);
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
