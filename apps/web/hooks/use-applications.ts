"use client";

import { useQuery } from "@tanstack/react-query";

import {
  queryKeys,
  type CandidateApplicationsParams,
  type RecruiterApplicationsByJobParams,
} from "@/lib/query";
import { clientApiFetch } from "./_client-fetch";

interface ApplicationDetailResponse {
  data: unknown;
}

interface ApplicationInterviewsResponse {
  data: unknown[];
}

interface ApplicationOffersResponse {
  data: unknown[];
}

export function useApplicationDetailQuery(applicationId: string) {
  return useQuery({
    queryKey: ["candidate-applications", "detail", applicationId],
    queryFn: ({ signal }) =>
      clientApiFetch<ApplicationDetailResponse>(
        `/api/v1/applications/${applicationId}`,
        { signal },
      ),
    enabled: Boolean(applicationId),
  });
}

export function useApplicationInterviewsQuery(applicationId: string) {
  return useQuery({
    queryKey: ["candidate-applications", "interviews", applicationId],
    queryFn: ({ signal }) =>
      clientApiFetch<ApplicationInterviewsResponse>(
        `/api/v1/applications/${applicationId}/interviews`,
        { signal },
      ),
    enabled: Boolean(applicationId),
  });
}

export function useApplicationOffersQuery(applicationId: string) {
  return useQuery({
    queryKey: ["candidate-applications", "offers", applicationId],
    queryFn: ({ signal }) =>
      clientApiFetch<ApplicationOffersResponse>(
        `/api/v1/applications/${applicationId}/offers`,
        { signal },
      ),
    enabled: Boolean(applicationId),
  });
}

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
