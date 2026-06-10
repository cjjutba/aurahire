import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { eq } from "drizzle-orm";
import { profilesTable } from "@aurahire/db";
import type { AuthUser, CompanyMemberRole } from "@aurahire/shared";

import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { SKIP_ACTIVE_COMPANY_KEY } from "../decorators/skip-active-company.decorator";
import { REQUIRE_COMPANY_ROLE_KEY } from "../decorators/require-company-role.decorator";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";
import { CompanyMembersRepository } from "../../modules/companies/company-members.repository";
import { CacheService, TAGS, TTL_SECONDS } from "../../cache";
import type { CompanyMember } from "@aurahire/db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves the active company for every authenticated request and
 * attaches `req.activeCompanyId` + `req.companyRole`. Runs AFTER
 * `SupabaseAuthGuard` and `RolesGuard`.
 *
 * Bypass priority (each short-circuits the rest):
 *   1. `@Public()` route → bypass entirely (no auth either)
 *   2. No `req.user` (defer to upstream guards) → bypass
 *   3. `user.role === 'admin'` → bypass (admins act across tenants;
 *      controllers that mix admin + member access branch on role)
 *   4. `user.role === 'candidate'` → bypass (multi-tenancy doesn't apply
 *      to candidates; their resources are scoped by candidate_id)
 *   5. `@SkipActiveCompany()` route → bypass (used for endpoints that
 *      run BEFORE membership exists: POST /companies, /invitations/accept,
 *      /profiles/me, etc.)
 *   6. Resolve company id: `X-Active-Company-Id` header (UUID-validated)
 *      then `profiles.last_active_company_id` from the DB
 *   7. None → 403 NO_ACTIVE_COMPANY
 *   8. Membership check (status='active' only). Stale, invited, suspended,
 *      and left rows return null → 403 NOT_A_MEMBER.
 *   9. `@RequireCompanyRole(...)` enforcement.
 *
 * Registered globally as the third APP_GUARD (after SupabaseAuthGuard +
 * RolesGuard) in `app.module.ts`.
 */
@Injectable()
export class ActiveCompanyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly companyMembersRepo: CompanyMembersRepository,
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly cacheService: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. @Public() bypass - defense in depth (these routes also skip auth).
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      user?: AuthUser;
      headers: Record<string, string | string[] | undefined>;
      activeCompanyId?: string;
      companyRole?: CompanyMemberRole | null;
    }>();
    const user = req.user;

    // 2. No user - defer to SupabaseAuthGuard (which runs before us).
    // Reaching here without a user means the upstream guard either
    // already returned 401 or this is an unauthenticated request that
    // somehow slipped past; either way, do not throw a misleading error.
    if (!user) return true;

    // 3. Admins bypass tenant scoping entirely. They DO NOT get a
    // companyRole; controllers that mix admin + member access must
    // branch on `req.user.role === 'admin'` explicitly.
    if (user.role === "admin") {
      req.activeCompanyId = undefined;
      req.companyRole = null;
      return true;
    }

    // 4. Candidates are not part of the multi-tenancy model. Their
    // resources are scoped by `candidate_id`, never by company. Skip
    // the membership lookup entirely so candidate-only endpoints don't
    // need an explicit @SkipActiveCompany() decorator.
    if (user.role === "candidate") {
      req.activeCompanyId = undefined;
      req.companyRole = null;
      return true;
    }

    // 5. @SkipActiveCompany() bypass - for routes needed BEFORE membership
    // exists (POST /companies, /invitations/accept, /profiles/me, etc.).
    // Checked AFTER admin/candidate role bypasses so that role-based skips
    // win over per-route opt-out (the role bypasses are stricter).
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_ACTIVE_COMPANY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    // 6. Resolve active company id: header → profile fallback → single-membership auto-resolve.
    const headerCompanyId = this.readHeader(req.headers);
    let companyId: string | null = headerCompanyId;

    if (!companyId) {
      // Always pull the live value - SupabaseAuthGuard's AuthUser doesn't
      // include lastActiveCompanyId, and trusting a cached value would
      // race against in-flight company switches.
      companyId = await this.lookupLastActiveCompanyId(user.id);
    }

    if (!companyId) {
      // Auto-heal: a user with exactly one active membership but no pointer
      // (seed gap, partial onboarding, leftover state) is unambiguously
      // resolvable. Pick that membership and persist the pointer so future
      // requests skip this branch. With 0 or 2+ memberships we still 403 -
      // the caller has to onboard or explicitly switch.
      const memberships = await this.companyMembersRepo.listActiveForUser(
        user.id,
      );
      const sole = memberships[0];
      if (memberships.length === 1 && sole) {
        companyId = sole.company.id;
        await this.db
          .update(profilesTable)
          .set({ lastActiveCompanyId: companyId })
          .where(eq(profilesTable.id, user.id));
        // Bust the cached profile-lookup so a fresh read sees the new pointer.
        await this.cacheService.bustTags([TAGS.userMemberships(user.id)]);
      }
    }

    if (!companyId) {
      throw new ForbiddenException({
        code: "NO_ACTIVE_COMPANY",
        message: "User has no active company. Create or accept an invitation.",
      });
    }

    // 7. Membership verification. The repo method already filters
    // status='active' - invited / suspended / left rows return null here.
    // Cached against (companyMembership, userMemberships) tags; existing
    // member-CRUD service paths bust both, so role/status changes propagate
    // immediately. Negative answers (null) are also cached to prevent
    // repeated DB hits from probes against companies the user doesn't belong to.
    const membership = await this.cacheService.getOrSet<CompanyMember | null>({
      key: `membership:${user.id}:${companyId}`,
      ttlSeconds: TTL_SECONDS.warm,
      tags: [TAGS.companyMembership(companyId), TAGS.userMemberships(user.id)],
      telemetryName: "guard:membership",
      load: () =>
        this.companyMembersRepo.findActiveMembership(user.id, companyId),
    });
    if (!membership) {
      throw new ForbiddenException({
        code: "NOT_A_MEMBER",
        message: "You are not a member of this company",
      });
    }

    // 8. @RequireCompanyRole(...) check.
    const requiredCompanyRoles = this.reflector.getAllAndOverride<
      CompanyMemberRole[] | undefined
    >(REQUIRE_COMPANY_ROLE_KEY, [context.getHandler(), context.getClass()]);

    if (requiredCompanyRoles && requiredCompanyRoles.length > 0) {
      if (!requiredCompanyRoles.includes(membership.role)) {
        throw new ForbiddenException({
          code: "INSUFFICIENT_COMPANY_ROLE",
          message: `Required role: ${requiredCompanyRoles.join(" | ")}`,
        });
      }
    }

    req.activeCompanyId = membership.companyId;
    req.companyRole = membership.role;
    return true;
  }

  /**
   * Read and validate the X-Active-Company-Id header. Throws 400 on a
   * malformed value rather than silently falling through to the profile
   * fallback - the caller asked for a specific company; respect that.
   */
  private readHeader(
    headers: Record<string, string | string[] | undefined>,
  ): string | null {
    const raw = headers["x-active-company-id"];
    if (raw === undefined) return null;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value) return null;
    if (!UUID_RE.test(value)) {
      throw new BadRequestException({
        code: "INVALID_ACTIVE_COMPANY_ID",
        message: "X-Active-Company-Id must be a UUID",
      });
    }
    return value;
  }

  private async lookupLastActiveCompanyId(
    userId: string,
  ): Promise<string | null> {
    return this.cacheService.getOrSet<string | null>({
      key: `last-active-company:${userId}`,
      ttlSeconds: TTL_SECONDS.warm,
      tags: [TAGS.userMemberships(userId)],
      telemetryName: "guard:last-active-company",
      load: async () => {
        const [row] = await this.db
          .select({ lastActiveCompanyId: profilesTable.lastActiveCompanyId })
          .from(profilesTable)
          .where(eq(profilesTable.id, userId))
          .limit(1);
        return row?.lastActiveCompanyId ?? null;
      },
    });
  }
}
