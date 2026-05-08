"use client";

import { getAccessToken } from "@aurahire/shared";

const DASHBOARD_PATHS = [
  "/api/v1/applications/recruiter-stats?range=7d",
  "/api/v1/applications/recruiter-analytics",
  "/api/v1/applications/recent?limit=6",
] as const;

/**
 * Fire-and-forget GETs to the three recruiter-dashboard endpoints with
 * `X-Active-Company-Id: {companyId}`. Results are discarded — purpose is
 * to populate the API's Redis cache before the user clicks switch, so the
 * subsequent SSR refresh hits warm cache.
 *
 * Errors are swallowed; this is a best-effort warmer that must never break
 * the click flow that follows.
 */
export function prefetchDashboardForCompany(companyId: string): void {
  if (typeof window === "undefined") return;

  const token = getAccessToken();
  if (!token) return;

  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) return;

  for (const path of DASHBOARD_PATHS) {
    try {
      void fetch(`${baseUrl}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Active-Company-Id": companyId,
        },
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Some browsers throw synchronously on bad URLs; keep the loop alive.
    }
  }
}
