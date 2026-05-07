import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { PrefetchedHydration, makeQueryClient, queryKeys } from "@/lib/query";
import { serverApiFetch } from "@/lib/query/server";

import { CandidateResumeClient } from "./_resume-client";

export const metadata = { title: "Resume" };

export default async function CandidateResumePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.candidateResumes.list(),
    queryFn: () => serverApiFetch<unknown>("/api/v1/resumes/mine"),
  });

  return (
    <PrefetchedHydration queryClient={queryClient}>
      <CandidateResumeClient />
    </PrefetchedHydration>
  );
}
