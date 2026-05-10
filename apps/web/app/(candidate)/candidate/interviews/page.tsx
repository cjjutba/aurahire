import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { makeQueryClient, PrefetchedHydration, queryKeys } from "@/lib/query";
import { serverQueries } from "@/lib/query/server";

import { CandidateInterviewsClient } from "./_interviews-client";

export const metadata = { title: "Interviews" };

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    format?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function CandidateInterviewsPage({
  searchParams,
}: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const params = {
    q: sp.q?.trim() || undefined,
    status: sp.status && sp.status !== "all" ? sp.status : undefined,
    format: sp.format && sp.format !== "all" ? sp.format : undefined,
    sort: sp.sort ?? "upcoming",
    page: sp.page ? Math.max(1, Number(sp.page)) : 1,
    limit: 25,
  };

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.candidateInterviews.list({}),
    queryFn: () => serverQueries.candidateInterviews({}),
  });

  return (
    <PrefetchedHydration queryClient={queryClient}>
      <CandidateInterviewsClient params={params} />
    </PrefetchedHydration>
  );
}
