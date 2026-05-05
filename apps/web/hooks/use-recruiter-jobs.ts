"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys, type RecruiterJobsListParams } from "@/lib/query";
import { clientApiFetch } from "./_client-fetch";

interface RecruiterJobsListResponse {
  data: unknown[];
  meta: { total: number; page: number; limit: number };
}

export function useRecruiterJobsQuery(params: RecruiterJobsListParams) {
  return useQuery({
    queryKey: queryKeys.recruiterJobs.list(params),
    queryFn: ({ signal }) =>
      clientApiFetch<RecruiterJobsListResponse>("/api/v1/jobs/mine", {
        query: {
          status: params.status,
          page: params.page,
          include: params.include,
        },
        signal,
      }),
  });
}

export function useRecruiterJobDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.recruiterJobs.detail(id),
    queryFn: ({ signal }) =>
      clientApiFetch<unknown>(`/api/v1/jobs/${id}`, { signal }),
    enabled: Boolean(id),
  });
}
