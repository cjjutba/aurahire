export { makeQueryClient } from "./query-client";
export { queryKeys } from "./keys";
export type {
  RecruiterJobsListParams,
  RecruiterShortlistParams,
  RecruiterInterviewsParams,
  RecruiterApplicationsByJobParams,
  RecruiterApplicationsListParams,
  CandidateJobsListParams,
  CandidateApplicationsParams,
  CandidateInterviewsParams,
} from "./keys";
// Type-only re-exports — TypeScript erases these so client bundles
// don't transitively import the server-only ./queries.ts module.
export type {
  RecruiterStatsResponse,
  RecruiterAnalyticsResponse,
  RecruiterRecentApplicationItem,
} from "./queries";
export { PrefetchedHydration } from "./hydration";
