import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";
import type { JWTPayload } from "jose";
import { profilesTable } from "@aurahire/db";
import type { AuthUser } from "@aurahire/shared";

import {
  createSupabaseJwtVerifier,
  type SupabaseJwtVerifier,
} from "../common/auth/verify-supabase-jwt";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../db/db.module";

@Injectable()
export class WsJwtUtil {
  private readonly logger = new Logger(WsJwtUtil.name);
  private readonly verifier: SupabaseJwtVerifier;

  constructor(
    private readonly config: ConfigService,
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
  ) {
    const supabaseUrl = config.getOrThrow<string>("SUPABASE_URL");
    this.verifier = createSupabaseJwtVerifier({ supabaseUrl });
  }

  /**
   * Verifies the JWT from a Socket.io handshake and returns the AuthUser, or
   * null on any failure (invalid token, missing profile, suspended account).
   * Logs at warn level for ops visibility but does not throw - the gateway
   * decides what to do with a null (disconnect).
   */
  async authenticate(token: string | undefined): Promise<AuthUser | null> {
    if (!token || typeof token !== "string") return null;

    let payload: JWTPayload;
    try {
      payload = await this.verifier.verify(token);
    } catch {
      return null;
    }

    const userId = payload.sub;
    if (!userId || typeof userId !== "string") return null;

    const rows = await this.db
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

    const profile = rows[0];
    if (!profile) {
      this.logger.warn(`WS handshake rejected: profile missing for ${userId}`);
      return null;
    }
    if (profile.status === "suspended" || profile.status === "deleted") {
      this.logger.warn(
        `WS handshake rejected: account ${profile.status} for ${userId}`,
      );
      return null;
    }

    return {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      status: profile.status,
      fullName: profile.fullName,
      profileCompleted: true,
    };
  }
}
