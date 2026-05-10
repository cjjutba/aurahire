import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import {
  companiesTable,
  companyMembersTable,
  jobsTable,
  profilesTable,
  type Company,
} from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../../db/db.module";

export interface ListAdminCompaniesFilters {
  q?: string;
  page: number;
  limit: number;
}

export interface AdminCompanyRow extends Company {
  ownerName: string | null;
  ownerEmail: string | null;
  memberCount: number;
  jobCount: number;
}

@Injectable()
export class AdminCompaniesRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async list(
    filters: ListAdminCompaniesFilters,
  ): Promise<{ rows: AdminCompanyRow[]; total: number }> {
    const offset = (filters.page - 1) * filters.limit;
    const conditions: SQL[] = [];
    if (filters.q && filters.q.trim()) {
      conditions.push(ilike(companiesTable.name, `%${filters.q.trim()}%`));
    }

    const where =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : and(...conditions);

    // Count total first.
    const totalRows = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(companiesTable)
      .where(where);
    const total = totalRows[0]?.c ?? 0;

    // Paginated list with owner profile join + per-company member/job counts.
    // The counts are computed inline via correlated subqueries to keep the
    // primary query a single round-trip.
    const rows = await this.db
      .select({
        company: companiesTable,
        ownerName: profilesTable.fullName,
        ownerEmail: profilesTable.email,
        memberCount: sql<number>`(
          SELECT count(*)::int FROM ${companyMembersTable}
          WHERE ${companyMembersTable.companyId} = ${companiesTable.id}
            AND ${companyMembersTable.status} = 'active'
        )`,
        jobCount: sql<number>`(
          SELECT count(*)::int FROM ${jobsTable}
          WHERE ${jobsTable.companyId} = ${companiesTable.id}
        )`,
      })
      .from(companiesTable)
      .leftJoin(profilesTable, eq(profilesTable.id, companiesTable.createdBy))
      .where(where)
      .orderBy(desc(companiesTable.createdAt))
      .limit(filters.limit)
      .offset(offset);

    return {
      rows: rows.map((r) => ({
        ...r.company,
        ownerName: r.ownerName,
        ownerEmail: r.ownerEmail,
        memberCount: r.memberCount ?? 0,
        jobCount: r.jobCount ?? 0,
      })),
      total,
    };
  }

  async findById(id: string): Promise<Company | null> {
    const [row] = await this.db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, id))
      .limit(1);
    return row ?? null;
  }

  async deleteById(id: string): Promise<void> {
    await this.db.delete(companiesTable).where(eq(companiesTable.id, id));
  }

  /** Lightweight summary list for filter dropdowns (e.g. audit log filter). */
  async listAllForFilters(): Promise<
    Array<{ id: string; name: string; logoUrl: string | null }>
  > {
    return this.db
      .select({
        id: companiesTable.id,
        name: companiesTable.name,
        logoUrl: companiesTable.logoUrl,
      })
      .from(companiesTable)
      .orderBy(companiesTable.name);
  }
}
