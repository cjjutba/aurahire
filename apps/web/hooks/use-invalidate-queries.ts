"use client";

import { useQueryClient } from "@tanstack/react-query";

/**
 * Returns helper functions that invalidate scoped subtrees of the React Query
 * cache. Call after a mutation succeeds. The backend already busts its Redis
 * tags; this just makes the client refetch.
 *
 * Example:
 *   const inv = useInvalidate();
 *   const mutation = useJobsControllerPublishV1({
 *     mutation: { onSuccess: () => inv.recruiterJobs() },
 *   });
 */
export function useInvalidate() {
  const qc = useQueryClient();
  return {
    recruiterJobs: () => qc.invalidateQueries({ queryKey: ["recruiter-jobs"] }),
    recruiterDashboard: () =>
      qc.invalidateQueries({ queryKey: ["recruiter-dashboard"] }),
    recruiterApplications: () =>
      qc.invalidateQueries({ queryKey: ["recruiter-applications"] }),
    recruiterShortlist: () =>
      qc.invalidateQueries({ queryKey: ["recruiter-shortlist"] }),
    recruiterInterviews: () =>
      qc.invalidateQueries({ queryKey: ["recruiter-interviews"] }),
    candidateJobs: () => qc.invalidateQueries({ queryKey: ["candidate-jobs"] }),
    candidateApplications: () =>
      qc.invalidateQueries({ queryKey: ["candidate-applications"] }),
    candidateInterviews: () =>
      qc.invalidateQueries({ queryKey: ["candidate-interviews"] }),
    profileScore: () => qc.invalidateQueries({ queryKey: ["profile-score"] }),
  };
}
