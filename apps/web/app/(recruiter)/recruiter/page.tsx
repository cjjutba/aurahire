import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { makeQueryClient, PrefetchedHydration, queryKeys } from "@/lib/query";
import { serverQueries } from "@/lib/query/server";

import { RecruiterDashboardClient } from "./_dashboard-client";

export const metadata = { title: "Recruiter Dashboard" };

const DEFAULT_RANGE = "7d";
const DEFAULT_RECENT_LIMIT = 6;

export default async function RecruiterDashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const queryClient = makeQueryClient();
  // Promise.allSettled, a single 403/404 from one endpoint must not block
  // the page render of the other sections.
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: queryKeys.recruiterDashboard.stats(DEFAULT_RANGE),
      queryFn: () => serverQueries.recruiterDashboardStats(DEFAULT_RANGE),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.recruiterDashboard.analytics(),
      queryFn: () => serverQueries.recruiterDashboardAnalytics(),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.recruiterDashboard.recent(DEFAULT_RECENT_LIMIT),
      queryFn: () =>
        serverQueries.recruiterDashboardRecent(DEFAULT_RECENT_LIMIT),
    }),
  ]);

  return (
    <PrefetchedHydration queryClient={queryClient}>
      <RecruiterDashboardClient
        defaultRange={DEFAULT_RANGE}
        recentLimit={DEFAULT_RECENT_LIMIT}
      />
    </PrefetchedHydration>
  );
}
