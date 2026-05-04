import type { CookieOptions } from "@supabase/ssr";

/**
 * Marker cookie name. Presence of this cookie (with value "1") signals that
 * the current session is intentionally non-persistent — the user did NOT
 * tick "Remember me" at sign-in. The marker itself is also a session cookie,
 * so it dies on browser close (along with the auth cookies it gates).
 */
export const SESSION_ONLY_MARKER = "ah-session-only";

export function stripPersistenceFromCookieOptions(options: CookieOptions): CookieOptions {
  const { maxAge: _maxAge, expires: _expires, ...rest } = options ?? {};
  return rest;
}
