import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "@aurahire/shared";

export const ROLES_KEY = "roles";

/**
 * Restrict a controller method to specific user roles.
 * RolesGuard reads this metadata and rejects mismatched users with 403.
 *
 * Usage:
 *   @Roles("recruiter")
 *   @Post("/jobs")
 *   create(...) { ... }
 *
 *   @Roles("admin", "recruiter")
 *   @Get("/sensitive")
 *   read(...) { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
