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
import { eq } from "drizzle-orm";
import { profilesTable } from "@aurahire/db";
import type { AuthUser } from "@aurahire/shared";

import {
  createClerkJwtVerifier,
  type ClerkJwtVerifier,
} from "../auth/verify-clerk-jwt";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";
import { ProfileProvisioningService } from "../../clerk/profile-provisioning.service";

/**
 * Validates Clerk session JWTs and attaches the AuthUser to the request.
 * Replaces SupabaseAuthGuard. Resolves the local profile by `clerk_user_id`
 * (the token `sub`); profiles are provisioned by the Clerk webhook (Story 2.3).
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);
  private readonly verifier: ClerkJwtVerifier;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly provisioning: ProfileProvisioningService,
  ) {
    this.verifier = createClerkJwtVerifier({
      jwksUrl: config.getOrThrow<string>("CLERK_JWKS_URL"),
      issuer: config.getOrThrow<string>("CLERK_JWT_ISSUER"),
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    const clerkUserId = payload.sub;
    if (!clerkUserId || typeof clerkUserId !== "string") {
      throw new UnauthorizedException({
        code: "INVALID_TOKEN",
        message: "Token missing user identifier",
      });
    }

    let p = await this.loadProfile(clerkUserId);
    if (!p) {
      // Lazy provision: the user.created webhook can't reach localhost in dev,
      // and may race the first request in prod. Fetch from the Clerk Backend
      // API + upsert, then retry once.
      try {
        await this.provisioning.ensureFromClerk(clerkUserId);
        p = await this.loadProfile(clerkUserId);
      } catch (err) {
        this.logger.warn(
          `Lazy profile provision failed for ${clerkUserId}: ${(err as Error).message}`,
        );
      }
    }
    if (!p) {
      throw new UnauthorizedException({
        code: "PROFILE_MISSING",
        message: "Profile not initialized for this user",
      });
    }

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

  private async loadProfile(clerkUserId: string) {
    const rows = await this.db
      .select({
        id: profilesTable.id,
        email: profilesTable.email,
        role: profilesTable.role,
        status: profilesTable.status,
        fullName: profilesTable.fullName,
      })
      .from(profilesTable)
      .where(eq(profilesTable.clerkUserId, clerkUserId))
      .limit(1);
    return rows[0] ?? null;
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
