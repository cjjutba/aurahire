import "server-only";

import { serverApiFetch } from "./server-fetch";
import type {
  RecruiterJobsListParams,
  RecruiterShortlistParams,
  RecruiterInterviewsParams,
  RecruiterApplicationsByJobParams,
  RecruiterApplicationsListParams,
  CandidateJobsListParams,
  CandidateApplicationsParams,
  CandidateInterviewsParams,
} from "./keys";

export interface RecruiterStatsResponse {
  data: {
    activeJobs?: number;
    totalApps?: number;
    totalApplications?: number;
    pendingReview?: number;
    pendingReviews?: number;
    avgMatchScore?: number;
  };
}

export interface RecruiterAnalyticsResponse {
  data: {
    kpis: {
      activeJobs: number;
      totalApplications: number;
      pendingReviews: number;
      avgMatchScore: number;
    };
    topJobs: Array<{
      jobId: string;
      title: string;
      status: string;
      applicationCount: number;
      avgScore: number;
    }>;
    applicationsByStatus: Array<{ status: string; count: number }>;
  };
}

export interface RecruiterRecentApplicationItem {
  id: string;
  status: string;
  appliedAt: string;
  candidate: { fullName: string; email: string } | null;
  job: { id: string; title: string } | null;
  matchScore: { band: string; overallScore: number } | null;
}

export const serverQueries = {
  recruiterDashboardStats: (range: string) =>
    serverApiFetch<RecruiterStatsResponse>(
      "/api/v1/applications/recruiter-stats",
      {
        query: { range },
      },
    ),
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
    serverApiFetch<{
      data: unknown[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>("/api/v1/jobs/mine", {
      query: {
        q: params.q,
        status: params.status,
        mode: params.mode,
        experienceLevel: params.experienceLevel,
        sort: params.sort,
        page: params.page,
        limit: params.limit,
        include: params.include,
      },
    }),
  recruiterJobDetail: (id: string) =>
    serverApiFetch<unknown>(`/api/v1/jobs/${id}`),
  recruiterShortlist: (params: RecruiterShortlistParams) =>
    serverApiFetch<{ data: unknown[]; meta: { total: number } }>(
      "/api/v1/applications/shortlist",
      { query: { page: params.page } },
    ),
  recruiterInterviews: (params: RecruiterInterviewsParams) =>
    serverApiFetch<{
      data: unknown[];
      meta?: { page: number; limit: number; total: number; totalPages: number };
    }>("/api/v1/interviews/by-recruiter/me", {
      query: {
        q: params.q,
        status: params.status,
        format: params.format,
        sort: params.sort,
        page: params.page,
        limit: params.limit,
      },
    }),
  recruiterApplicationsByJob: (
    jobId: string,
    params: RecruiterApplicationsByJobParams,
  ) =>
    serverApiFetch<{ data: unknown[]; meta: { total: number } }>(
      "/api/v1/applications",
      { query: { jobId, status: params.status, page: params.page } },
    ),
  recruiterApplicationsList: (params: RecruiterApplicationsListParams) =>
    serverApiFetch<{
      data: unknown[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>("/api/v1/applications/recruiter-list", {
      query: {
        q: params.q,
        status: params.status,
        jobId: params.jobId,
        band: params.band,
        sort: params.sort,
        page: params.page,
        limit: params.limit,
      },
    }),
  candidateJobsList: (params: CandidateJobsListParams) =>
    serverApiFetch<{
      data: unknown[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>("/api/v1/jobs/for-candidate", {
      query: {
        q: params.q,
        mode: params.mode,
        experienceLevel: params.experienceLevel,
        sort: params.sort,
        page: params.page,
        limit: params.limit,
        // Only emit when truthy — sending "false" would be coerced to true by
        // any naive Boolean() parser on the receiver and the backend's Zod
        // schema is hardened against this anyway.
        excludeApplied: params.excludeApplied ? "1" : undefined,
      },
    }),
  candidateJobDetail: (id: string) =>
    serverApiFetch<unknown>(`/api/v1/jobs/${id}/for-candidate`),
  candidateApplications: (params: CandidateApplicationsParams) =>
    serverApiFetch<{ data: unknown[]; meta: { total: number } }>(
      "/api/v1/applications/mine",
      { query: { status: params.status, page: params.page } },
    ),
  candidateInterviews: (params: CandidateInterviewsParams) =>
    serverApiFetch<{ data: unknown[] }>("/api/v1/interviews/mine", {
      query: { status: params.status, page: params.page },
    }),
  profileScoreMe: () => serverApiFetch<unknown>("/api/v1/scoring/profile/me"),
  myMatchPreviews: () =>
    serverApiFetch<{
      data: Array<{
        id: string;
        jobId: string;
        resumeId: string;
        overallScore: number;
        band: "strong" | "partial" | "limited";
        source: "system" | "candidate";
        createdAt: string;
        job: {
          id: string;
          title: string;
          company: { id: string; name: string; logoUrl: string | null } | null;
        } | null;
      }>;
    }>("/api/v1/scoring/match-previews"),
} as const;
