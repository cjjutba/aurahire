import { SetMetadata } from "@nestjs/common";

export const SKIP_ACTIVE_COMPANY_KEY = "skip_active_company";

/**
 * Mark a route as not requiring an active company resolution.
 * Used for endpoints needed BEFORE membership exists (e.g. POST /companies,
 * /invitations/accept, /invitations/preview, /profiles/me, /profiles/me/memberships).
 *
 * `ActiveCompanyGuard` reads this metadata and short-circuits.
 */
export const SkipActiveCompany = () =>
  SetMetadata(SKIP_ACTIVE_COMPANY_KEY, true);
