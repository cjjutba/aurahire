"use client";

import { useQuery } from "@tanstack/react-query";

import {
  queryKeys,
  type CandidateApplicationsParams,
  type RecruiterApplicationsByJobParams,
} from "@/lib/query";
import { clientApiFetch } from "./_client-fetch";

interface ApplicationsListResponse {
  data: unknown[];
  meta: { total: number };
}

export function useMyApplicationsQuery(params: CandidateApplicationsParams) {
  return useQuery({
    queryKey: queryKeys.candidateApplications.list(params),
    queryFn: ({ signal }) =>
      clientApiFetch<ApplicationsListResponse>("/api/v1/applications/mine", {
        query: { status: params.status, page: params.page },
        signal,
      }),
  });
}

export function useRecruiterApplicationsByJobQuery(
  jobId: string,
  params: RecruiterApplicationsByJobParams,
) {
  return useQuery({
    queryKey: queryKeys.recruiterApplications.byJob(jobId, params),
    queryFn: ({ signal }) =>
      clientApiFetch<ApplicationsListResponse>("/api/v1/applications", {
        query: { jobId, status: params.status, page: params.page },
        signal,
      }),
    enabled: Boolean(jobId),
  });
}
