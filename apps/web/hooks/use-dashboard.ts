"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query";
import type {
  RecruiterStatsResponse,
  RecruiterAnalyticsResponse,
  RecruiterRecentApplicationItem,
} from "@/lib/query";
import { clientApiFetch } from "./_client-fetch";

export function useRecruiterStatsQuery(range: string) {
  return useQuery({
    queryKey: queryKeys.recruiterDashboard.stats(range),
    queryFn: ({ signal }) =>
      clientApiFetch<RecruiterStatsResponse>("/api/v1/applications/recruiter-stats", {
        query: { range },
        signal,
      }),
  });
}

export function useRecruiterAnalyticsQuery() {
  return useQuery({
    queryKey: queryKeys.recruiterDashboard.analytics(),
    queryFn: ({ signal }) =>
      clientApiFetch<RecruiterAnalyticsResponse>(
        "/api/v1/applications/recruiter-analytics",
        { signal },
      ),
  });
}

export function useRecruiterRecentApplicationsQuery(limit: number) {
  return useQuery({
    queryKey: queryKeys.recruiterDashboard.recent(limit),
    queryFn: ({ signal }) =>
      clientApiFetch<{ data: RecruiterRecentApplicationItem[] }>(
        "/api/v1/applications/recent",
        { query: { limit }, signal },
      ),
  });
}
