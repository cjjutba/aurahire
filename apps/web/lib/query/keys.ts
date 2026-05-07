export const queryKeys = {
  recruiterDashboard: {
    stats: (range: string) => ["recruiter-dashboard", "stats", range] as const,
    analytics: () => ["recruiter-dashboard", "analytics"] as const,
    recent: (limit: number) => ["recruiter-dashboard", "recent", limit] as const,
  },
  recruiterJobs: {
    list: (params: RecruiterJobsListParams) =>
      ["recruiter-jobs", "list", params] as const,
    detail: (id: string) => ["recruiter-jobs", "detail", id] as const,
  },
  recruiterShortlist: {
    list: (params: RecruiterShortlistParams) =>
      ["recruiter-shortlist", "list", params] as const,
  },
  recruiterInterviews: {
    list: (params: RecruiterInterviewsParams) =>
      ["recruiter-interviews", "list", params] as const,
  },
  recruiterApplications: {
    byJob: (jobId: string, params: RecruiterApplicationsByJobParams) =>
      ["recruiter-applications", "by-job", jobId, params] as const,
  },
  candidateJobs: {
    list: (params: CandidateJobsListParams) =>
      ["candidate-jobs", "list", params] as const,
    detail: (id: string) => ["candidate-jobs", "detail", id] as const,
  },
  candidateApplications: {
    list: (params: CandidateApplicationsParams) =>
      ["candidate-applications", "list", params] as const,
  },
  candidateInterviews: {
    list: (params: CandidateInterviewsParams) =>
      ["candidate-interviews", "list", params] as const,
  },
  profileScore: {
    me: () => ["profile-score", "me"] as const,
  },
  candidateResumes: {
    list: () => ["candidate-resumes", "list"] as const,
    download: (id: string) => ["candidate-resumes", "download", id] as const,
  },
} as const;

export interface RecruiterJobsListParams {
  q?: string;
  status?: string;
  mode?: string;
  experienceLevel?: string;
  sort?: string;
  page?: number;
  limit?: number;
  include?: "stats";
}
export interface RecruiterShortlistParams {
  page?: number;
}
export interface RecruiterInterviewsParams {
  q?: string;
  status?: string;
  format?: string;
  sort?: string;
  page?: number;
  limit?: number;
}
export interface RecruiterApplicationsByJobParams {
  status?: string;
  page?: number;
}
export interface CandidateJobsListParams {
  q?: string;
  mode?: string;
  experienceLevel?: string;
  sort?: string;
  page?: number;
  limit?: number;
}
export interface CandidateApplicationsParams {
  status?: string;
  page?: number;
}
export interface CandidateInterviewsParams {
  status?: string;
  page?: number;
}
