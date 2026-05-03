import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import {
  auditLogsTable,
  profilesTable,
  type AuditLog,
  type Profile,
} from "@aurahire/db";
import type { AuditActorType } from "@aurahire/shared";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../../db/db.module";

export interface ListAdminAuditFilters {
  actorId?: string;
  q?: string;
  entityType?: string;
  action?: string;
  actorType?: AuditActorType;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  limit: number;
}

export interface AuditJoinedRow {
  log: AuditLog;
  actor: Profile | null;
}

@Injectable()
export class AdminAuditRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async list(filters: ListAdminAuditFilters): Promise<{
    rows: AuditJoinedRow[];
    total: number;
  }> {
    const offset = (filters.page - 1) * filters.limit;
    const where = this.buildWhere(filters);

    const rows = await this.db
      .select({
        log: auditLogsTable,
        actor: profilesTable,
      })
      .from(auditLogsTable)
      .leftJoin(profilesTable, eq(profilesTable.id, auditLogsTable.actorId))
      .where(where)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(filters.limit)
      .offset(offset);

    const totalRows = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(auditLogsTable)
      .leftJoin(profilesTable, eq(profilesTable.id, auditLogsTable.actorId))
      .where(where);

    return {
      rows: rows.map((r) => ({ log: r.log, actor: r.actor ?? null })),
      total: totalRows[0]?.c ?? 0,
    };
  }

  async findById(id: string): Promise<AuditJoinedRow | null> {
    const [row] = await this.db
      .select({
        log: auditLogsTable,
        actor: profilesTable,
      })
      .from(auditLogsTable)
      .leftJoin(profilesTable, eq(profilesTable.id, auditLogsTable.actorId))
      .where(eq(auditLogsTable.id, id))
      .limit(1);
    if (!row) return null;
    return { log: row.log, actor: row.actor ?? null };
  }

  /** For CSV export: same filters, no pagination, capped at maxRows. */
  async listAll(
    filters: Omit<ListAdminAuditFilters, "page" | "limit">,
    maxRows: number,
  ): Promise<{ rows: AuditJoinedRow[]; truncated: boolean; rowCount: number }> {
    const where = this.buildWhere({ ...filters, page: 1, limit: 0 });
    const rows = await this.db
      .select({
        log: auditLogsTable,
        actor: profilesTable,
      })
      .from(auditLogsTable)
      .leftJoin(profilesTable, eq(profilesTable.id, auditLogsTable.actorId))
      .where(where)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(maxRows + 1);

    const truncated = rows.length > maxRows;
    return {
      rows: rows
        .slice(0, maxRows)
        .map((r) => ({ log: r.log, actor: r.actor ?? null })),
      truncated,
      rowCount: rows.length > maxRows ? maxRows : rows.length,
    };
  }

  private buildWhere(
    filters:
      | Omit<ListAdminAuditFilters, "page" | "limit">
      | ListAdminAuditFilters,
  ) {
    const conditions = [];
    if (filters.actorId)
      conditions.push(eq(auditLogsTable.actorId, filters.actorId));
    if (filters.entityType)
      conditions.push(eq(auditLogsTable.entityType, filters.entityType));
    if (filters.action)
      conditions.push(ilike(auditLogsTable.action, `%${filters.action}%`));
    if (filters.actorType)
      conditions.push(eq(auditLogsTable.actorType, filters.actorType));
    if (filters.dateFrom)
      conditions.push(gte(auditLogsTable.createdAt, filters.dateFrom));
    if (filters.dateTo)
      conditions.push(lte(auditLogsTable.createdAt, filters.dateTo));
    if (filters.q) {
      const pattern = `%${filters.q}%`;
      const orExpr = or(
        ilike(profilesTable.fullName, pattern),
        ilike(profilesTable.email, pattern),
      );
      if (orExpr) conditions.push(orExpr);
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}
