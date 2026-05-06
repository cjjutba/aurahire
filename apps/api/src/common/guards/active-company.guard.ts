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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves the active company for every authenticated request and
 * attaches `req.activeCompanyId` + `req.companyRole`. Runs AFTER
 * `SupabaseAuthGuard` and `RolesGuard`.
 *
 * Resolution priority:
 *   1. `@Public()` or `@SkipActiveCompany()` → bypass entirely
 *   2. `req.user.role === 'admin'` → bypass (admins act across tenants)
 *   3. `X-Active-Company-Id` header (validated as UUID)
 *   4. `profiles.last_active_company_id` (read from DB; the in-memory
 *      AuthUser doesn't carry it)
 *   5. None → 403 NO_ACTIVE_COMPANY
 *
 * Membership check uses `CompanyMembersRepository.findActiveMembership`
 * which only returns rows with `status='active'` — invited / suspended /
 * left rows are not authorized to act.
 *
 * NOTE for Phase 2a: this guard is NOT registered globally. It will be
 * enabled in Phase 2c after every recruiter endpoint has been scoped to
 * `req.activeCompanyId`. Wiring it before that would 403 every recruiter
 * request.
 */
@Injectable()
export class ActiveCompanyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly companyMembersRepo: CompanyMembersRepository,
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. @Public() bypass — defense in depth.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // 2. @SkipActiveCompany() bypass — for routes needed BEFORE membership
    // exists (POST /companies, /invitations/accept, etc.).
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_ACTIVE_COMPANY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    const req = context.switchToHttp().getRequest<{
      user?: AuthUser;
      headers: Record<string, string | string[] | undefined>;
      activeCompanyId?: string;
      companyRole?: CompanyMemberRole | null;
    }>();
    const user = req.user;

    // 3. Should be unreachable — SupabaseAuthGuard runs first. Defer to
    // that guard rather than throwing here.
    if (!user) return true;

    // 4. Admin global users bypass tenant scoping. They DO NOT get a
    // companyRole; controllers that mix admin + member access must
    // branch on `req.user.role === 'admin'` explicitly.
    if (user.role === "admin") {
      req.activeCompanyId = undefined;
      req.companyRole = null;
      return true;
    }

    // 5. Resolve active company id: header → profile fallback.
    const headerCompanyId = this.readHeader(req.headers);
    let companyId: string | null = headerCompanyId;

    if (!companyId) {
      // Always pull the live value — SupabaseAuthGuard's AuthUser doesn't
      // include lastActiveCompanyId, and trusting a cached value would
      // race against in-flight company switches.
      companyId = await this.lookupLastActiveCompanyId(user.id);
    }

    if (!companyId) {
      throw new ForbiddenException({
        code: "NO_ACTIVE_COMPANY",
        message:
          "User has no active company. Create or accept an invitation.",
      });
    }

    // 6. Membership verification. The repo method already filters
    // status='active' — invited / suspended / left rows return null here.
    const membership = await this.companyMembersRepo.findActiveMembership(
      user.id,
      companyId,
    );
    if (!membership) {
      throw new ForbiddenException({
        code: "NOT_A_MEMBER",
        message: "You are not a member of this company",
      });
    }

    // 7. @RequireCompanyRole(...) check.
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
   * fallback — the caller asked for a specific company; respect that.
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
    const [row] = await this.db
      .select({ lastActiveCompanyId: profilesTable.lastActiveCompanyId })
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1);
    return row?.lastActiveCompanyId ?? null;
  }
}
