"use client";

import { createBrowserClient } from "@supabase/ssr";

import { stripPersistenceFromCookieOptions } from "./cookie-persistence";
import {
  getSessionOnlyMarkerFromDocument,
  readDocumentCookies,
  writeDocumentCookie,
} from "./cookie-persistence.client";

/**
 * Browser-side Supabase client. Use in Client Components.
 * Reads from NEXT_PUBLIC_* env vars (safe to bundle).
 *
 * Provides a custom cookie adapter so that "Remember me = false" sessions
 * downgrade Supabase auth cookies to session cookies (no Max-Age / Expires)
 *, they die when the browser closes. The middleware applies the same rule
 * on token refresh; together they keep non-persistent sessions truly
 * non-persistent across the full request lifecycle.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return readDocumentCookies();
        },
        setAll(cookiesToSet) {
          const sessionOnly = getSessionOnlyMarkerFromDocument();
          for (const { name, value, options } of cookiesToSet) {
            const finalOptions = sessionOnly
              ? stripPersistenceFromCookieOptions(options)
              : options;
            writeDocumentCookie(name, value, finalOptions);
          }
        },
      },
    },
  );
}
