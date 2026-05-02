import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole, AuthUser } from "@aurahire/shared";

import { ROLES_KEY } from "../decorators/roles.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // @Public() bypass — defense in depth; SupabaseAuthGuard runs first and already returns true
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() means "any authenticated user" — already covered by SupabaseAuthGuard.
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    if (!user) {
      // Should be unreachable — SupabaseAuthGuard runs before this
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "No authenticated user",
      });
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException({
        code: "INSUFFICIENT_ROLE",
        message: `Required role: ${requiredRoles.join(" | ")}`,
      });
    }

    return true;
  }
}
