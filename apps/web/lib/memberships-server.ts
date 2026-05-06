/**
 * Server-side fetcher for the caller's memberships. Returns an empty array on
 * any failure — callers route based on count, so a soft-fail is preferable to
 * tearing down the whole onboarding fork.
 */
export interface ServerMembership {
  companyId: string;
  companyName: string;
  companyLogoUrl: string | null;
  role: "owner" | "admin" | "recruiter";
  joinedAt: string | null;
  status: "active" | "invited" | "suspended" | "left";
}

export async function fetchMyMemberships(
  accessToken: string,
): Promise<ServerMembership[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/profiles/me/memberships`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { data: ServerMembership[] };
  return body.data ?? [];
}
