import "server-only";

import { serverApiFetch } from "./server-fetch";
import type {
  RecruiterJobsListParams,
  RecruiterShortlistParams,
  RecruiterInterviewsParams,
  RecruiterApplicationsByJobParams,
  CandidateJobsListParams,
  CandidateApplicationsParams,
  CandidateInterviewsParams,
} from "./keys";

export interface RecruiterStatsResponse {
  totals: {
    candidates: number;
    new: number;
    interviewed: number;
    offered: number;
    hired: number;
  };
  range: string;
}

export interface RecruiterAnalyticsResponse {
  pipeline: Array<{ stage: string; count: number }>;
  conversion: { applied_to_hired: number };
}

export interface RecruiterRecentApplicationItem {
  id: string;
  candidateName: string;
  jobTitle: string;
  status: string;
  appliedAt: string;
  matchScore: number | null;
}

export const serverQueries = {
  recruiterDashboardStats: (range: string) =>
    serverApiFetch<RecruiterStatsResponse>("/api/v1/applications/recruiter-stats", {
      query: { range },
    }),
  recruiterDashboardAnalytics: () =>
    serverApiFetch<RecruiterAnalyticsResponse>(
      "/api/v1/applications/recruiter-analytics",
    ),
  recruiterDashboardRecent: (limit: number) =>
    serverApiFetch<{ data: RecruiterRecentApplicationItem[] }>(
      "/api/v1/applications/recent",
      { query: { limit } },
    ),
  recruiterJobsList: (params: RecruiterJobsListParams) =>
    serverApiFetch<{ data: unknown[]; meta: { total: number; page: number; limit: number } }>(
      "/api/v1/jobs/mine",
      { query: { status: params.status, page: params.page, include: params.include } },
    ),
  recruiterJobDetail: (id: string) =>
    serverApiFetch<unknown>(`/api/v1/jobs/${id}`),
  recruiterShortlist: (params: RecruiterShortlistParams) =>
    serverApiFetch<{ data: unknown[]; meta: { total: number } }>(
      "/api/v1/applications/shortlist",
      { query: { page: params.page } },
    ),
  recruiterInterviews: (params: RecruiterInterviewsParams) =>
    serverApiFetch<{ data: unknown[]; meta: { total: number } }>(
      "/api/v1/interviews",
      { query: { status: params.status, page: params.page, scope: "recruiter" } },
    ),
  recruiterApplicationsByJob: (jobId: string, params: RecruiterApplicationsByJobParams) =>
    serverApiFetch<{ data: unknown[]; meta: { total: number } }>(
      "/api/v1/applications",
      { query: { jobId, status: params.status, page: params.page } },
    ),
  candidateJobsList: (params: CandidateJobsListParams) =>
    serverApiFetch<{ data: unknown[]; meta: { total: number } }>(
      "/api/v1/jobs/for-candidate",
      {
        query: {
          q: params.q,
          mode: params.mode,
          experienceLevel: params.experienceLevel,
          page: params.page,
        },
      },
    ),
  candidateJobDetail: (id: string) =>
    serverApiFetch<unknown>(`/api/v1/jobs/for-candidate/${id}`),
  candidateApplications: (params: CandidateApplicationsParams) =>
    serverApiFetch<{ data: unknown[]; meta: { total: number } }>(
      "/api/v1/applications/mine",
      { query: { status: params.status, page: params.page } },
    ),
  candidateInterviews: (params: CandidateInterviewsParams) =>
    serverApiFetch<{ data: unknown[]; meta: { total: number } }>(
      "/api/v1/interviews",
      { query: { status: params.status, page: params.page, scope: "candidate" } },
    ),
  profileScoreMe: () =>
    serverApiFetch<unknown>("/api/v1/scoring/profile/me"),
} as const;
