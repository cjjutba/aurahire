import { createServerClient } from "./server";

/**
 * Get the current Supabase session (server-side). Returns null if no session.
 */
export async function getCurrentSession() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * Get the current Supabase user (server-side). Returns null if not authenticated.
 *
 * This is the Supabase user object (id, email, ...), NOT the AuraHire profile.
 * To get the AuraHire profile + role, call GET /api/v1/profiles/me.
 */
export async function getCurrentSupabaseUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Get the AuraHire profile for the authenticated user via the backend.
 * Returns null if not authenticated or profile not initialized yet.
 */
export async function getCurrentProfile() {
  const session = await getCurrentSession();
  if (!session) return null;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/profiles/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) return null;
  const body = (await res.json()) as { data: unknown };
  return body.data;
}
