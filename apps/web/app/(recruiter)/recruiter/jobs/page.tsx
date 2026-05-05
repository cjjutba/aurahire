import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { makeQueryClient, PrefetchedHydration, queryKeys } from "@/lib/query";
import { serverQueries } from "@/lib/query/server";

import { JobsListClient } from "./_jobs-list-client";

export const metadata = { title: "My Jobs" };

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    mode?: string;
    experienceLevel?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function RecruiterJobsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const params = {
    q: sp.q?.trim() || undefined,
    status: sp.status && sp.status !== "all" ? sp.status : undefined,
    mode: sp.mode && sp.mode !== "all" ? sp.mode : undefined,
    experienceLevel: sp.experienceLevel && sp.experienceLevel !== "all" ? sp.experienceLevel : undefined,
    sort: sp.sort ?? "recent",
    page: sp.page ? Math.max(1, Number(sp.page)) : 1,
    limit: 25,
    include: "stats" as const,
  };

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.recruiterJobs.list(params),
    queryFn: () => serverQueries.recruiterJobsList(params),
  });

  return (
    <PrefetchedHydration queryClient={queryClient}>
      <JobsListClient params={params} />
    </PrefetchedHydration>
  );
}
