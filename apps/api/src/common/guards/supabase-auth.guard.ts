import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { type JWTPayload } from "jose";
import {
  createSupabaseJwtVerifier,
  type SupabaseJwtVerifier,
} from "../auth/verify-supabase-jwt";
import { eq } from "drizzle-orm";
import { profilesTable } from "@aurahire/db";
import type { AuthUser } from "@aurahire/shared";

import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);
  private readonly verifier: SupabaseJwtVerifier;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
  ) {
    const supabaseUrl = config.getOrThrow<string>("SUPABASE_URL");
    this.verifier = createSupabaseJwtVerifier({ supabaseUrl });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Bypass for @Public() routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const token = this.extractToken(req);
    if (!token) {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Missing authorization token",
      });
    }

    let payload: JWTPayload;
    try {
      payload = await this.verifier.verify(token);
    } catch {
      throw new UnauthorizedException({
        code: "INVALID_TOKEN",
        message: "Invalid or expired token",
      });
    }

    const userId = payload.sub;
    if (!userId || typeof userId !== "string") {
      throw new UnauthorizedException({
        code: "INVALID_TOKEN",
        message: "Token missing user identifier",
      });
    }

    // Fetch role + status from profiles table
    // (Sprint trade-off: 1 DB query per request. Phase 2 may move role into JWT custom claims.)
    const profile = await this.db
      .select({
        id: profilesTable.id,
        email: profilesTable.email,
        role: profilesTable.role,
        status: profilesTable.status,
        fullName: profilesTable.fullName,
      })
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1);

    if (profile.length === 0) {
      throw new UnauthorizedException({
        code: "PROFILE_MISSING",
        message: "Profile not initialized for this user",
      });
    }

    const p = profile[0]!;

    if (p.status === "suspended") {
      throw new UnauthorizedException({
        code: "ACCOUNT_SUSPENDED",
        message: "This account is suspended",
      });
    }

    if (p.status === "deleted") {
      throw new UnauthorizedException({
        code: "ACCOUNT_DELETED",
        message: "This account no longer exists",
      });
    }

    // profileCompleted defaults to true here; the /profiles/me endpoint
    // (Slice 1.4) returns the authoritative flag from the role-specific table.
    const authUser: AuthUser = {
      id: p.id,
      email: p.email,
      role: p.role,
      status: p.status,
      fullName: p.fullName,
      profileCompleted: true,
    };

    req.user = authUser;
    return true;
  }

  private extractToken(req: {
    headers: Record<string, string | string[] | undefined>;
  }): string | null {
    const header = req.headers["authorization"];
    if (!header || typeof header !== "string") return null;
    const [scheme, token] = header.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) return null;
    return token;
  }
}
