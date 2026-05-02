import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Mark a controller method (or whole controller) as not requiring authentication.
 * SupabaseAuthGuard checks this metadata and bypasses JWT validation.
 *
 * Usage:
 *   @Public()
 *   @Get("/health")
 *   check() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
