/**
 * Server-side fetcher for the public invitation preview endpoint. Used by
 * /invite/[token] and /onboarding/invite to render a server-side preview
 * before any client-side accept/decline.
 *
 * The endpoint is public (no auth header required) — the token IS the auth.
 * Returns null on unknown / consumed tokens (404 from the API).
 */
export interface InvitationPreview {
  companyName: string;
  companyLogoUrl: string | null;
  inviterName: string;
  role: "owner" | "admin" | "recruiter";
  expiresAt: string;
  status: "invited" | "active" | "suspended" | "left";
  isExpired: boolean;
}

export async function fetchInvitationPreview(
  token: string,
): Promise<InvitationPreview | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const url = new URL(`${apiUrl}/api/v1/invitations/preview`);
  url.searchParams.set("token", token);

  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) return null;

  const body = (await res.json()) as { data: InvitationPreview };
  return body.data;
}
