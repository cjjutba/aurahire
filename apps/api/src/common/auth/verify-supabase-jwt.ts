import { Logger } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface SupabaseJwtVerifierOptions {
  supabaseUrl: string;
}

export interface SupabaseJwtVerifier {
  verify(token: string): Promise<JWTPayload>;
}

/**
 * Builds a verifier that validates Supabase-issued JWTs against the project's
 * JWKS. Used by both the REST guard (`SupabaseAuthGuard`) and the WebSocket
 * handshake - keeps a single source of truth for issuer/audience/JWKS caching.
 */
export function createSupabaseJwtVerifier(
  options: SupabaseJwtVerifierOptions,
): SupabaseJwtVerifier {
  const issuer = `${options.supabaseUrl}/auth/v1`;
  const jwks = createRemoteJWKSet(
    new URL(`${options.supabaseUrl}/auth/v1/.well-known/jwks.json`),
    {
      cacheMaxAge: 24 * 60 * 60 * 1000, // 24h
      cooldownDuration: 30_000,
    },
  );
  const logger = new Logger("SupabaseJwt");

  return {
    async verify(token: string): Promise<JWTPayload> {
      try {
        const result = await jwtVerify(token, jwks, {
          issuer,
          audience: "authenticated",
        });
        return result.payload;
      } catch (err) {
        logger.warn(`JWT verification failed: ${(err as Error).message}`);
        throw err;
      }
    },
  };
}
