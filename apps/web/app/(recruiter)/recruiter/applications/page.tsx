import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import {
  makeQueryClient,
  PrefetchedHydration,
  queryKeys,
  type RecruiterApplicationsListParams,
} from "@/lib/query";
import { serverQueries } from "@/lib/query/server";

import { ApplicationsListClient } from "./_applications-list-client";

export const metadata = { title: "Applications · AuraHire" };

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    band?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function RecruiterApplicationsPage({
  searchParams,
}: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const params: Required<
    Pick<RecruiterApplicationsListParams, "page" | "limit" | "sort">
  > &
    Pick<RecruiterApplicationsListParams, "q" | "status" | "band"> = {
    q: sp.q?.trim() || undefined,
    status: sp.status && sp.status !== "all" ? sp.status : undefined,
    band: sp.band && sp.band !== "all" ? sp.band : undefined,
    sort: sp.sort ?? "recent",
    page: sp.page ? Math.max(1, Number(sp.page)) : 1,
    limit: 25,
  };

  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.recruiterApplications.list(params),
    queryFn: () => serverQueries.recruiterApplicationsList(params),
  });

  return (
    <PrefetchedHydration queryClient={queryClient}>
      <ApplicationsListClient params={params} />
    </PrefetchedHydration>
  );
}
