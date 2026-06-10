import { Logger } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface ClerkJwtVerifierOptions {
  /** Clerk JWKS URL, e.g. https://<sub>.clerk.accounts.dev/.well-known/jwks.json */
  jwksUrl: string;
  /** Clerk issuer (Frontend API URL), e.g. https://<sub>.clerk.accounts.dev */
  issuer: string;
}

export interface ClerkJwtVerifier {
  verify(token: string): Promise<JWTPayload>;
}

/**
 * Builds a verifier for Clerk-issued session JWTs (the migration's replacement
 * for Supabase Auth). Mirrors the old Supabase verifier's shape so the guard +
 * any other consumers swap cleanly.
 *
 * Clerk session tokens carry `iss` = the Frontend API URL and `sub` = the Clerk
 * user id ("user_..."); by default they set no fixed `aud`, so we validate
 * signature (against the cached JWKS) + issuer + expiry only.
 */
export function createClerkJwtVerifier(
  options: ClerkJwtVerifierOptions,
): ClerkJwtVerifier {
  const jwks = createRemoteJWKSet(new URL(options.jwksUrl), {
    cacheMaxAge: 24 * 60 * 60 * 1000, // 24h
    cooldownDuration: 30_000,
  });
  const logger = new Logger("ClerkJwt");

  return {
    async verify(token: string): Promise<JWTPayload> {
      try {
        const { payload } = await jwtVerify(token, jwks, {
          issuer: options.issuer,
        });
        return payload;
      } catch (err) {
        logger.warn(`Clerk JWT verification failed: ${(err as Error).message}`);
        throw err;
      }
    },
  };
}
