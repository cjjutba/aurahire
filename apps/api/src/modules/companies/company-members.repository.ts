import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  companiesTable,
  companyMembersTable,
  profilesTable,
  type Company,
  type CompanyMember,
  type NewCompanyMember,
  type Profile,
} from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";

/**
 * Single-row repository for `company_members`. Used by:
 *  - `ActiveCompanyGuard` to verify (userId, companyId) → membership
 *  - the (Phase 2b) companies + invitations controllers
 *
 * Read methods filter by `status='active'` only when the suffix says so;
 * `findActiveMembership` returns null for invited/suspended/left rows so
 * the guard rejects them — pending invitees are not authorized to act on
 * the company yet.
 */
@Injectable()
export class CompanyMembersRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  // ─── Reads ────────────────────────────────────────────────────────────

  /**
   * The hot path for `ActiveCompanyGuard`. Returns null for any row that
   * isn't currently active (invited, suspended, left). Indexed on
   * (user_id, status).
   */
  async findActiveMembership(
    userId: string,
    companyId: string,
  ): Promise<CompanyMember | null> {
    const [row] = await this.db
      .select()
      .from(companyMembersTable)
      .where(
        and(
          eq(companyMembersTable.userId, userId),
          eq(companyMembersTable.companyId, companyId),
          eq(companyMembersTable.status, "active"),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findById(id: string): Promise<CompanyMember | null> {
    const [row] = await this.db
      .select()
      .from(companyMembersTable)
      .where(eq(companyMembersTable.id, id))
      .limit(1);
    return row ?? null;
  }

  /** Lookup by single-use invitation token; returns the row regardless of status. */
  async findByToken(token: string): Promise<CompanyMember | null> {
    const [row] = await this.db
      .select()
      .from(companyMembersTable)
      .where(eq(companyMembersTable.invitationToken, token))
      .limit(1);
    return row ?? null;
  }

  /** Every membership row for a user (any status), with the company joined. */
  async listForUser(
    userId: string,
  ): Promise<Array<CompanyMember & { company: Company }>> {
    const rows = await this.db
      .select({
        member: companyMembersTable,
        company: companiesTable,
      })
      .from(companyMembersTable)
      .innerJoin(
        companiesTable,
        eq(companiesTable.id, companyMembersTable.companyId),
      )
      .where(eq(companyMembersTable.userId, userId))
      .orderBy(desc(companyMembersTable.joinedAt));
    return rows.map((r) => ({ ...r.member, company: r.company }));
  }

  /** Active memberships only, for the sidebar company switcher. */
  async listActiveForUser(
    userId: string,
  ): Promise<Array<CompanyMember & { company: Company }>> {
    const rows = await this.db
      .select({
        member: companyMembersTable,
        company: companiesTable,
      })
      .from(companyMembersTable)
      .innerJoin(
        companiesTable,
        eq(companiesTable.id, companyMembersTable.companyId),
      )
      .where(
        and(
          eq(companyMembersTable.userId, userId),
          eq(companyMembersTable.status, "active"),
        ),
      )
      .orderBy(desc(companyMembersTable.joinedAt));
    return rows.map((r) => ({ ...r.member, company: r.company }));
  }

  /**
   * Every membership row in a company — active members AND pending invites.
   * `user` is null for pending invitations (no user_id yet).
   * `inviterName` reads through a second profiles join keyed off `invited_by`.
   * Sort: active members first (joined_at desc), then pending invites
   * (invited_at desc) — NULLS LAST keeps invites trailing.
   */
  async listForCompany(
    companyId: string,
  ): Promise<
    Array<CompanyMember & { user: Profile | null; inviterName: string | null }>
  > {
    const inviterProfiles = alias(profilesTable, "inviter_profiles");
    const rows = await this.db
      .select({
        member: companyMembersTable,
        user: profilesTable,
        inviterName: inviterProfiles.fullName,
      })
      .from(companyMembersTable)
      .leftJoin(profilesTable, eq(profilesTable.id, companyMembersTable.userId))
      .leftJoin(
        inviterProfiles,
        eq(inviterProfiles.id, companyMembersTable.invitedBy),
      )
      .where(eq(companyMembersTable.companyId, companyId))
      .orderBy(
        sql`${companyMembersTable.joinedAt} DESC NULLS LAST`,
        desc(companyMembersTable.invitedAt),
      );
    return rows.map((r) => ({
      ...r.member,
      user: r.user,
      inviterName: r.inviterName,
    }));
  }

  /**
   * Count of currently-active owners in a company. Used to block the last
   * owner from leaving / deleting their account without first transferring
   * ownership.
   */
  async countActiveOwners(companyId: string): Promise<number> {
    const rows = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(companyMembersTable)
      .where(
        and(
          eq(companyMembersTable.companyId, companyId),
          eq(companyMembersTable.role, "owner"),
          eq(companyMembersTable.status, "active"),
        ),
      );
    return rows[0]?.c ?? 0;
  }

  /**
   * Used before creating a new invitation: an `email` may not have any row
   * in this company except `status='left'` (which we treat as freshly
   * re-invitable). Returns the most recent matching row, or null.
   */
  async findByEmailInCompany(
    companyId: string,
    email: string,
  ): Promise<CompanyMember | null> {
    const [row] = await this.db
      .select()
      .from(companyMembersTable)
      .where(
        and(
          eq(companyMembersTable.companyId, companyId),
          eq(companyMembersTable.email, email),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  // ─── Writes ───────────────────────────────────────────────────────────

  async insert(data: NewCompanyMember): Promise<CompanyMember> {
    const [row] = await this.db
      .insert(companyMembersTable)
      .values(data)
      .returning();
    if (!row) throw new Error("Company member insert failed");
    return row;
  }

  async update(
    id: string,
    patch: Partial<NewCompanyMember>,
  ): Promise<CompanyMember> {
    const [row] = await this.db
      .update(companyMembersTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(companyMembersTable.id, id))
      .returning();
    if (!row) throw new Error("Company member update failed");
    return row;
  }

  async deleteById(id: string): Promise<void> {
    await this.db
      .delete(companyMembersTable)
      .where(eq(companyMembersTable.id, id));
  }
}
