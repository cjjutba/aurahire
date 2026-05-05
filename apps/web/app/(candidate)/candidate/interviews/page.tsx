import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { makeQueryClient, PrefetchedHydration, queryKeys } from "@/lib/query";
import { serverQueries } from "@/lib/query/server";

import { CandidateInterviewsClient } from "./_interviews-client";

export const metadata = { title: "Interviews" };

export default async function CandidateInterviewsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.candidateInterviews.list({}),
    queryFn: () => serverQueries.candidateInterviews({}),
  });

  return (
    <PrefetchedHydration queryClient={queryClient}>
      <CandidateInterviewsClient />
    </PrefetchedHydration>
  );
}
