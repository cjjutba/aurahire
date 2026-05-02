import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import {
  biasFlagsTable,
  type BiasFlag,
  type NewBiasFlag,
} from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";

@Injectable()
export class BiasRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async insertMany(rows: NewBiasFlag[]): Promise<BiasFlag[]> {
    if (rows.length === 0) return [];
    return this.db.insert(biasFlagsTable).values(rows).returning();
  }

  async findByJobId(jobId: string): Promise<BiasFlag[]> {
    return this.db
      .select()
      .from(biasFlagsTable)
      .where(eq(biasFlagsTable.jobId, jobId))
      .orderBy(desc(biasFlagsTable.createdAt));
  }

  async findFlagged(jobId: string): Promise<BiasFlag[]> {
    return this.db
      .select()
      .from(biasFlagsTable)
      .where(
        and(
          eq(biasFlagsTable.jobId, jobId),
          eq(biasFlagsTable.status, "flagged"),
        ),
      )
      .orderBy(desc(biasFlagsTable.createdAt));
  }

  async findById(id: string): Promise<BiasFlag | null> {
    const [row] = await this.db
      .select()
      .from(biasFlagsTable)
      .where(eq(biasFlagsTable.id, id))
      .limit(1);
    return row ?? null;
  }

  async deleteFlaggedByJobId(jobId: string): Promise<number> {
    const rows = await this.db
      .delete(biasFlagsTable)
      .where(
        and(
          eq(biasFlagsTable.jobId, jobId),
          eq(biasFlagsTable.status, "flagged"),
        ),
      )
      .returning({ id: biasFlagsTable.id });
    return rows.length;
  }

  async markOverridden(
    id: string,
    overriddenBy: string,
    reason: string,
  ): Promise<BiasFlag> {
    const [row] = await this.db
      .update(biasFlagsTable)
      .set({
        status: "overridden",
        overrideReason: reason,
        overriddenBy,
        overriddenAt: new Date(),
      })
      .where(eq(biasFlagsTable.id, id))
      .returning();
    if (!row) throw new Error("Bias flag override failed");
    return row;
  }

  async markResolved(id: string): Promise<BiasFlag> {
    const [row] = await this.db
      .update(biasFlagsTable)
      .set({ status: "resolved" })
      .where(eq(biasFlagsTable.id, id))
      .returning();
    if (!row) throw new Error("Bias flag mark-resolved failed");
    return row;
  }
}
