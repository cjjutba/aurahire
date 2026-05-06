import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { CompanyMemberRole } from "@aurahire/shared";

/**
 * Resolved active-company context attached to the request by
 * `ActiveCompanyGuard`. Controllers grab it via the @ActiveCompany() param
 * decorator below.
 */
export interface ActiveCompanyContext {
  companyId: string;
  role: CompanyMemberRole;
}

/**
 * Param decorator that pulls the resolved active-company context off the
 * request. Throws if used on a route that didn't go through
 * `ActiveCompanyGuard` — that's a developer error, not a runtime case.
 *
 * Usage:
 *   @Get("/jobs")
 *   list(@ActiveCompany() { companyId }: ActiveCompanyContext) { ... }
 */
export const ActiveCompany = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActiveCompanyContext => {
    const req = ctx
      .switchToHttp()
      .getRequest<{ activeCompanyId?: string; companyRole?: CompanyMemberRole }>();
    if (!req.activeCompanyId || !req.companyRole) {
      throw new Error(
        "@ActiveCompany() used on a route without ActiveCompanyGuard. " +
          "Either apply ActiveCompanyGuard or remove the decorator.",
      );
    }
    return { companyId: req.activeCompanyId, role: req.companyRole };
  },
);
