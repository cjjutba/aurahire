import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import {
  makeQueryClient,
  PrefetchedHydration,
  queryKeys,
  serverQueries,
} from "@/lib/query";

import { CandidateJobsListClient } from "./_jobs-list-client";

export const metadata = { title: "Browse Jobs" };

interface PageProps {
  searchParams: Promise<{
    q?: string;
    mode?: string;
    experienceLevel?: string;
    page?: string;
  }>;
}

export default async function CandidateJobsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const params = {
    q: sp.q,
    mode: sp.mode,
    experienceLevel: sp.experienceLevel,
    page: sp.page ? Number(sp.page) : undefined,
  };

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.candidateJobs.list(params),
    queryFn: () => serverQueries.candidateJobsList(params),
  });

  return (
    <PrefetchedHydration queryClient={queryClient}>
      <CandidateJobsListClient
        q={params.q}
        mode={params.mode}
        experienceLevel={params.experienceLevel}
        page={params.page}
      />
    </PrefetchedHydration>
  );
}
