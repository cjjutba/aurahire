import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { companiesTable, type Company, type NewCompany } from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";

/**
 * Single-row repository for `companies`. Mirrors the style of
 * `CompanyMembersRepository` (also in this module). Membership operations
 * live there; this repository handles the company entity itself.
 */
@Injectable()
export class CompaniesRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async findById(id: string): Promise<Company | null> {
    const [row] = await this.db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, id))
      .limit(1);
    return row ?? null;
  }

  async insert(data: NewCompany): Promise<Company> {
    const [row] = await this.db.insert(companiesTable).values(data).returning();
    if (!row) throw new Error("Company insert failed");
    return row;
  }

  async update(id: string, patch: Partial<NewCompany>): Promise<Company> {
    const [row] = await this.db
      .update(companiesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(companiesTable.id, id))
      .returning();
    if (!row) throw new Error("Company update failed");
    return row;
  }

  async deleteById(id: string): Promise<void> {
    await this.db.delete(companiesTable).where(eq(companiesTable.id, id));
  }
}
