import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import {
  auditLogsTable,
  profilesTable,
  type Profile,
} from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../../db/db.module";

export interface ListAdminUsersFilters {
  role?: "candidate" | "recruiter" | "admin";
  status?: "active" | "suspended" | "deleted";
  q?: string;
  createdFrom?: Date;
  createdTo?: Date;
  page: number;
  limit: number;
}

export interface UpdateProfilePatch {
  role?: "candidate" | "recruiter" | "admin";
  status?: "active" | "suspended" | "deleted";
}

@Injectable()
export class AdminUsersRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async list(
    filters: ListAdminUsersFilters,
  ): Promise<{ rows: Profile[]; total: number }> {
    const offset = (filters.page - 1) * filters.limit;
    const conditions: SQL[] = [];
    if (filters.role) conditions.push(eq(profilesTable.role, filters.role));
    if (filters.status) conditions.push(eq(profilesTable.status, filters.status));
    if (filters.q) {
      const pattern = `%${filters.q}%`;
      const orClause = or(
        ilike(profilesTable.fullName, pattern),
        ilike(profilesTable.email, pattern),
      );
      if (orClause) conditions.push(orClause);
    }
    if (filters.createdFrom)
      conditions.push(gte(profilesTable.createdAt, filters.createdFrom));
    if (filters.createdTo)
      conditions.push(lte(profilesTable.createdAt, filters.createdTo));

    const where =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : and(...conditions);

    const rows = await this.db
      .select()
      .from(profilesTable)
      .where(where)
      .orderBy(desc(profilesTable.createdAt))
      .limit(filters.limit)
      .offset(offset);

    const totalRows = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(profilesTable)
      .where(where);

    return { rows, total: totalRows[0]?.c ?? 0 };
  }

  async findById(id: string): Promise<Profile | null> {
    const [row] = await this.db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, id))
      .limit(1);
    return row ?? null;
  }

  async update(id: string, patch: UpdateProfilePatch): Promise<Profile> {
    const [row] = await this.db
      .update(profilesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(profilesTable.id, id))
      .returning();
    if (!row) throw new Error("Profile update failed");
    return row;
  }

  async countAuditEntriesForUser(userId: string): Promise<number> {
    const rows = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(auditLogsTable)
      .where(eq(auditLogsTable.actorId, userId));
    return rows[0]?.c ?? 0;
  }
}
