import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import {
  makeQueryClient,
  PrefetchedHydration,
  queryKeys,
  serverQueries,
} from "@/lib/query";

import { RecruiterInterviewsClient } from "./_interviews-client";

export const metadata = { title: "Interviews" };

export default async function RecruiterInterviewsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.recruiterInterviews.list({}),
    queryFn: () => serverQueries.recruiterInterviews({}),
  });

  return (
    <PrefetchedHydration queryClient={queryClient}>
      <RecruiterInterviewsClient />
    </PrefetchedHydration>
  );
}
