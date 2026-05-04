import { cookies } from "next/headers";
import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";

import {
  SESSION_ONLY_MARKER,
  stripPersistenceFromCookieOptions,
} from "./cookie-persistence";

/**
 * Server-side Supabase client. Use in Server Components, Server Actions, Route Handlers.
 * Reads cookies for session; writes cookies on session refresh.
 *
 * Honors the "Remember me = false" marker cookie: when present, any cookies
 * written here are downgraded to session cookies (no Max-Age / Expires),
 * matching the behavior of the browser client and middleware.
 */
export async function createServerClient() {
  const cookieStore = await cookies();
  const sessionOnly = cookieStore.get(SESSION_ONLY_MARKER)?.value === "1";

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const finalOptions = sessionOnly
                ? stripPersistenceFromCookieOptions(options)
                : options;
              cookieStore.set(name, value, finalOptions);
            });
          } catch {
            // Setting cookies in Server Components throws — only middleware/Route Handlers can set them.
          }
        },
      },
    },
  );
}
