import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import {
  resumesTable,
  candidateProfilesTable,
  type Resume,
  type NewResume,
} from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";

@Injectable()
export class ResumesRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async insert(data: NewResume): Promise<Resume> {
    const [row] = await this.db.insert(resumesTable).values(data).returning();
    if (!row) throw new Error("Resume insert failed");
    return row;
  }

  async update(id: string, patch: Partial<NewResume>): Promise<Resume> {
    const [row] = await this.db
      .update(resumesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(resumesTable.id, id))
      .returning();
    if (!row) throw new Error("Resume update failed");
    return row;
  }

  async findById(id: string): Promise<Resume | null> {
    const [row] = await this.db
      .select()
      .from(resumesTable)
      .where(eq(resumesTable.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByCandidateId(candidateId: string): Promise<Resume[]> {
    return this.db
      .select()
      .from(resumesTable)
      .where(eq(resumesTable.candidateId, candidateId));
  }

  async findDefaultByCandidateId(candidateId: string): Promise<Resume | null> {
    const [row] = await this.db
      .select()
      .from(resumesTable)
      .where(
        and(eq(resumesTable.candidateId, candidateId), eq(resumesTable.isDefault, true)),
      )
      .limit(1);
    return row ?? null;
  }

  async setDefault(candidateId: string, resumeId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(resumesTable)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(resumesTable.candidateId, candidateId));

      await tx
        .update(resumesTable)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(resumesTable.id, resumeId));

      await tx
        .update(candidateProfilesTable)
        .set({ defaultResumeId: resumeId, updatedAt: new Date() })
        .where(eq(candidateProfilesTable.id, candidateId));
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(resumesTable).where(eq(resumesTable.id, id));
  }

  async hasResumes(candidateId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: resumesTable.id })
      .from(resumesTable)
      .where(eq(resumesTable.candidateId, candidateId))
      .limit(1);
    return rows.length > 0;
  }
}
