import "server-only";

import { auth } from "@clerk/nextjs/server";

/**
 * Clerk-backed session shape compatible with existing call sites that read
 * `session.access_token` (the bearer token forwarded to the NestJS API) and a
 * minimal `session.user`. `email`/`user_metadata` are left empty here to avoid a
 * per-request Clerk Backend API call; the authoritative profile (incl. email)
 * comes from GET /profiles/me via getCurrentProfile().
 */
export interface AppSession {
  access_token: string;
  user: { id: string; email: string; user_metadata: Record<string, unknown> };
}

/** Current Clerk session (server-side). Returns null if not authenticated. */
export async function getCurrentSession(): Promise<AppSession | null> {
  const { userId, getToken } = await auth();
  if (!userId) return null;
  const token = await getToken();
  if (!token) return null;
  return {
    access_token: token,
    user: { id: userId, email: "", user_metadata: {} },
  };
}

/**
 * Get the AuraHire profile for the authenticated user via the backend.
 * Returns null if not authenticated or profile not initialized yet.
 */
export async function getCurrentProfile() {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) return null;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/profiles/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) return null;
  const body = (await res.json()) as { data: unknown };
  return body.data;
}
