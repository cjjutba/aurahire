import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { interviewVenuesTable } from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";

@Injectable()
export class InterviewVenuesRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async list(companyId: string) {
    return this.db
      .select()
      .from(interviewVenuesTable)
      .where(eq(interviewVenuesTable.companyId, companyId))
      .orderBy(
        desc(interviewVenuesTable.isDefault),
        asc(interviewVenuesTable.label),
      );
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(interviewVenuesTable)
      .where(eq(interviewVenuesTable.id, id))
      .limit(1);
    return row ?? null;
  }

  async insert(input: typeof interviewVenuesTable.$inferInsert) {
    const [row] = await this.db
      .insert(interviewVenuesTable)
      .values(input)
      .returning();
    if (!row) throw new Error("Insert returned no row");
    return row;
  }

  async update(
    id: string,
    patch: Partial<typeof interviewVenuesTable.$inferInsert>,
  ) {
    const [row] = await this.db
      .update(interviewVenuesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(interviewVenuesTable.id, id))
      .returning();
    if (!row) throw new Error("Update returned no row");
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.db
      .delete(interviewVenuesTable)
      .where(eq(interviewVenuesTable.id, id));
  }

  async clearDefaultForCompany(
    companyId: string,
    exceptId?: string,
  ): Promise<void> {
    const cond = exceptId
      ? and(
          eq(interviewVenuesTable.companyId, companyId),
          ne(interviewVenuesTable.id, exceptId),
        )
      : eq(interviewVenuesTable.companyId, companyId);
    await this.db
      .update(interviewVenuesTable)
      .set({ isDefault: false })
      .where(cond);
  }
}
