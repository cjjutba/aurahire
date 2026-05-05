"use client";

import { useQuery } from "@tanstack/react-query";

import {
  queryKeys,
  type RecruiterInterviewsParams,
  type CandidateInterviewsParams,
} from "@/lib/query";
import { clientApiFetch } from "./_client-fetch";

interface InterviewsListResponse {
  data: unknown[];
  meta: { total: number };
}

export function useRecruiterInterviewsQuery(params: RecruiterInterviewsParams) {
  return useQuery({
    queryKey: queryKeys.recruiterInterviews.list(params),
    queryFn: ({ signal }) =>
      clientApiFetch<InterviewsListResponse>("/api/v1/interviews", {
        query: { status: params.status, page: params.page, scope: "recruiter" },
        signal,
      }),
  });
}

export function useMyInterviewsQuery(params: CandidateInterviewsParams) {
  return useQuery({
    queryKey: queryKeys.candidateInterviews.list(params),
    queryFn: ({ signal }) =>
      clientApiFetch<InterviewsListResponse>("/api/v1/interviews", {
        query: { status: params.status, page: params.page, scope: "candidate" },
        signal,
      }),
  });
}
