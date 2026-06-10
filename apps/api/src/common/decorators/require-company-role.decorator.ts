import { SetMetadata } from "@nestjs/common";
import type { CompanyMemberRole } from "@aurahire/shared";

export const REQUIRE_COMPANY_ROLE_KEY = "require_company_role";

/**
 * Restrict a route to specific roles within the active company.
 * Read by `ActiveCompanyGuard`. The check happens AFTER membership is
 * verified - admin global users (profiles.role='admin') bypass the active
 * company check entirely and never reach this gate.
 *
 * Usage:
 *   @RequireCompanyRole("owner")
 *   @Delete("/companies/me")
 *   delete(...) { ... }
 *
 *   @RequireCompanyRole("owner", "admin")
 *   @Post("/companies/me/members")
 *   invite(...) { ... }
 */
export const RequireCompanyRole = (...roles: CompanyMemberRole[]) =>
  SetMetadata(REQUIRE_COMPANY_ROLE_KEY, roles);
