import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { makeQueryClient, PrefetchedHydration, queryKeys } from "@/lib/query";
import { serverQueries } from "@/lib/query/server";

import { JobsListClient } from "./_jobs-list-client";

export const metadata = { title: "My Jobs" };

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function RecruiterJobsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const params = {
    status: sp.status && sp.status !== "all" ? sp.status : undefined,
    page: sp.page ? Number(sp.page) : undefined,
  };

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.recruiterJobs.list(params),
    queryFn: () => serverQueries.recruiterJobsList(params),
  });

  return (
    <PrefetchedHydration queryClient={queryClient}>
      <JobsListClient status={params.status} page={params.page} />
    </PrefetchedHydration>
  );
}
