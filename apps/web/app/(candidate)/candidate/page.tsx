import { redirect } from "next/navigation";

import { getCurrentSession, getCurrentProfile } from "@/lib/auth/session";
import { makeQueryClient, PrefetchedHydration, queryKeys } from "@/lib/query";
import { serverQueries } from "@/lib/query/server";

import { CandidateDashboardClient } from "./_dashboard-client";

export const metadata = { title: "Candidate Dashboard" };

interface ProfileMe {
  fullName: string;
}

export default async function CandidateDashboard() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const profile = (await getCurrentProfile()) as ProfileMe | null;

  const queryClient = makeQueryClient();
  // Promise.allSettled — a single 403/404 from one endpoint must not block
  // the page render of the other sections. prefetchQuery catches errors on
  // its own, but allSettled is the explicit, defensive form.
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: queryKeys.profileScore.me(),
      queryFn: () => serverQueries.profileScoreMe(),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.candidateApplications.list({}),
      queryFn: () => serverQueries.candidateApplications({}),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.candidateInterviews.list({}),
      queryFn: () => serverQueries.candidateInterviews({}),
    }),
  ]);

  return (
    <PrefetchedHydration queryClient={queryClient}>
      <CandidateDashboardClient fullName={profile?.fullName ?? null} />
    </PrefetchedHydration>
  );
}
