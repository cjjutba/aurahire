import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { makeQueryClient, PrefetchedHydration, queryKeys } from "@/lib/query";
import { serverApiFetch, serverQueries } from "@/lib/query/server";

import { CandidateJobsListClient } from "./_jobs-list-client";

export const metadata = { title: "Browse Jobs" };

interface PageProps {
  searchParams: Promise<{
    q?: string;
    mode?: string;
    experienceLevel?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function CandidateJobsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const params = {
    q: sp.q?.trim() || undefined,
    mode: sp.mode && sp.mode !== "all" ? sp.mode : undefined,
    experienceLevel:
      sp.experienceLevel && sp.experienceLevel !== "all" ? sp.experienceLevel : undefined,
    sort: sp.sort ?? "recent",
    page: sp.page ? Math.max(1, Number(sp.page)) : 1,
    limit: 12,
  };

  const queryClient = makeQueryClient();
  const [, appsResult] = await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.candidateJobs.list(params),
      queryFn: () => serverQueries.candidateJobsList(params),
    }),
    serverApiFetch<{ data: Array<{ id: string; jobId: string }> }>(
      "/api/v1/applications/mine",
    ).catch(() => null),
  ]);

  const appliedJobMap: Record<string, string> = {};
  if (appsResult) {
    for (const a of appsResult.data) {
      appliedJobMap[a.jobId] = a.id;
    }
  }

  return (
    <PrefetchedHydration queryClient={queryClient}>
      <CandidateJobsListClient params={params} appliedJobMap={appliedJobMap} />
    </PrefetchedHydration>
  );
}
