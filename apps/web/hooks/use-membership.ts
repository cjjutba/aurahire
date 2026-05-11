"use client";

import { useQuery } from "@tanstack/react-query";

import { clientApiFetch } from "./_client-fetch";

export interface Membership {
  companyId: string;
  companyName: string;
  companyLogoUrl: string | null;
  role: "owner" | "admin" | "recruiter";
  joinedAt: string | null;
  status: "active" | "invited" | "suspended" | "left";
}

export interface MembershipsResponse {
  data: Membership[];
}

export const MEMBERSHIPS_QUERY_KEY = ["my-memberships"] as const;

export function useMembershipsQuery(enabled: boolean = true) {
  return useQuery({
    queryKey: MEMBERSHIPS_QUERY_KEY,
    queryFn: ({ signal }) =>
      clientApiFetch<MembershipsResponse>("/api/v1/profiles/me/memberships", {
        signal,
      }),
    enabled,
  });
}

/**
 * PATCH /profiles/me { lastActiveCompanyId }, moves the server-side
 * `last_active_company_id` pointer so server-rendered pages and the
 * ActiveCompanyGuard fallback see the new value on the next request.
 */
export async function setActiveCompanyOnServer(
  companyId: string,
): Promise<void> {
  await clientApiFetch("/api/v1/profiles/me", {
    method: "PATCH",
    body: { lastActiveCompanyId: companyId },
  });
}
