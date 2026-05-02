import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthUser } from "@aurahire/shared";

/**
 * Extract the authenticated user from the request (attached by SupabaseAuthGuard).
 *
 * Usage:
 *   @Get("/me")
 *   getMe(@CurrentUser() user: AuthUser) { return user; }
 *
 * If the route is @Public() and no user is attached, returns undefined.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthUser | undefined;
  },
);
