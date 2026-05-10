"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys, type CandidateJobsListParams } from "@/lib/query";
import { clientApiFetch } from "./_client-fetch";

interface CandidateJobsListResponse {
  data: unknown[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function useCandidateJobsQuery(params: CandidateJobsListParams) {
  return useQuery({
    queryKey: queryKeys.candidateJobs.list(params),
    queryFn: ({ signal }) =>
      clientApiFetch<CandidateJobsListResponse>("/api/v1/jobs/for-candidate", {
        query: {
          q: params.q,
          mode: params.mode,
          experienceLevel: params.experienceLevel,
          sort: params.sort,
          page: params.page,
          limit: params.limit,
        },
        signal,
      }),
  });
}

export function useCandidateJobDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.candidateJobs.detail(id),
    queryFn: ({ signal }) =>
      clientApiFetch<unknown>(`/api/v1/jobs/${id}/for-candidate`, { signal }),
    enabled: Boolean(id),
  });
}
