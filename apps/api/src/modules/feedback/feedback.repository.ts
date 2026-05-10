import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import {
  feedbackTable,
  profilesTable,
  companiesTable,
  type Feedback,
  type NewFeedback,
} from "@aurahire/db";
import type {
  FeedbackType,
  FeedbackSeverity,
  FeedbackStatus,
  UserRole,
} from "@aurahire/shared";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";

export interface FeedbackJoinedRow {
  feedback: Feedback;
  submitter: {
    id: string;
    fullName: string;
    email: string;
    role: UserRole;
  } | null;
  company: { id: string; name: string; logoUrl: string | null } | null;
}

@Injectable()
export class FeedbackRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async insert(data: NewFeedback): Promise<Feedback> {
    const [row] = await this.db.insert(feedbackTable).values(data).returning();
    if (!row) throw new Error("Feedback insert failed");
    return row;
  }

  async update(
    id: string,
    patch: Partial<NewFeedback>,
  ): Promise<Feedback | null> {
    const [row] = await this.db
      .update(feedbackTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(feedbackTable.id, id))
      .returning();
    return row ?? null;
  }

  async findByIdWithJoins(id: string): Promise<FeedbackJoinedRow | null> {
    const [row] = await this.db
      .select({
        feedback: feedbackTable,
        submitterId: profilesTable.id,
        submitterFullName: profilesTable.fullName,
        submitterEmail: profilesTable.email,
        submitterRole: profilesTable.role,
        companyId: companiesTable.id,
        companyName: companiesTable.name,
        companyLogoUrl: companiesTable.logoUrl,
      })
      .from(feedbackTable)
      .leftJoin(profilesTable, eq(profilesTable.id, feedbackTable.submitterId))
      .leftJoin(companiesTable, eq(companiesTable.id, feedbackTable.companyId))
      .where(eq(feedbackTable.id, id))
      .limit(1);
    return row ? this.toJoinedRow(row) : null;
  }

  async list(options: {
    status?: FeedbackStatus;
    type?: FeedbackType;
    severity?: FeedbackSeverity;
    q?: string;
    page: number;
    limit: number;
  }): Promise<{ rows: FeedbackJoinedRow[]; total: number }> {
    const conditions: SQL[] = [];
    if (options.status) {
      conditions.push(eq(feedbackTable.status, options.status));
    }
    if (options.type) {
      conditions.push(eq(feedbackTable.type, options.type));
    }
    if (options.severity) {
      conditions.push(eq(feedbackTable.severity, options.severity));
    }
    if (options.q && options.q.trim()) {
      const term = `%${options.q.trim().toLowerCase()}%`;
      conditions.push(
        sql`(lower(${feedbackTable.subject}) like ${term} or lower(${feedbackTable.message}) like ${term} or lower(${feedbackTable.submitterEmail}) like ${term} or lower(${feedbackTable.submitterName}) like ${term})`,
      );
    }
    const where =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : and(...conditions);

    const countQuery = this.db
      .select({ count: count() })
      .from(feedbackTable);
    const countRows = await (where ? countQuery.where(where) : countQuery);
    const total = Number(countRows[0]?.count ?? 0);

    const rowsQuery = this.db
      .select({
        feedback: feedbackTable,
        submitterId: profilesTable.id,
        submitterFullName: profilesTable.fullName,
        submitterEmail: profilesTable.email,
        submitterRole: profilesTable.role,
        companyId: companiesTable.id,
        companyName: companiesTable.name,
        companyLogoUrl: companiesTable.logoUrl,
      })
      .from(feedbackTable)
      .leftJoin(profilesTable, eq(profilesTable.id, feedbackTable.submitterId))
      .leftJoin(companiesTable, eq(companiesTable.id, feedbackTable.companyId));

    const rows = await (where ? rowsQuery.where(where) : rowsQuery)
      .orderBy(desc(feedbackTable.createdAt))
      .limit(options.limit)
      .offset((options.page - 1) * options.limit);

    return {
      rows: rows.map((r) => this.toJoinedRow(r)),
      total,
    };
  }

  async statusCounts(): Promise<Record<FeedbackStatus, number>> {
    const rows = await this.db
      .select({
        status: feedbackTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(feedbackTable)
      .groupBy(feedbackTable.status);
    const out: Record<FeedbackStatus, number> = {
      new: 0,
      reviewing: 0,
      resolved: 0,
      dismissed: 0,
    };
    for (const r of rows) {
      out[r.status as FeedbackStatus] = Number(r.count);
    }
    return out;
  }

  private toJoinedRow(row: {
    feedback: Feedback;
    submitterId: string | null;
    submitterFullName: string | null;
    submitterEmail: string | null;
    submitterRole: UserRole | null;
    companyId: string | null;
    companyName: string | null;
    companyLogoUrl: string | null;
  }): FeedbackJoinedRow {
    return {
      feedback: row.feedback,
      submitter:
        row.submitterId && row.submitterFullName && row.submitterEmail && row.submitterRole
          ? {
              id: row.submitterId,
              fullName: row.submitterFullName,
              email: row.submitterEmail,
              role: row.submitterRole,
            }
          : null,
      company: row.companyId
        ? {
            id: row.companyId,
            name: row.companyName ?? "",
            logoUrl: row.companyLogoUrl,
          }
        : null,
    };
  }
}
