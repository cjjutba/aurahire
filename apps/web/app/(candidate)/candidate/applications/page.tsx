import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { makeQueryClient, PrefetchedHydration, queryKeys } from "@/lib/query";
import { serverQueries } from "@/lib/query/server";

import { ApplicationsListClient } from "./_applications-client";

export const metadata = { title: "My Applications" };

export default async function ApplicationsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.candidateApplications.list({}),
    queryFn: () => serverQueries.candidateApplications({}),
  });

  return (
    <PrefetchedHydration queryClient={queryClient}>
      <ApplicationsListClient />
    </PrefetchedHydration>
  );
}
