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
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.profileScore.me(),
      queryFn: () => serverQueries.profileScoreMe(),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.candidateApplications.list({}),
      queryFn: () => serverQueries.candidateApplications({}),
    }),
  ]);

  return (
    <PrefetchedHydration queryClient={queryClient}>
      <CandidateDashboardClient fullName={profile?.fullName ?? null} />
    </PrefetchedHydration>
  );
}
