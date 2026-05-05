import type { ReactNode } from "react";
import {
  HydrationBoundary,
  dehydrate,
  type QueryClient,
} from "@tanstack/react-query";

interface PrefetchedHydrationProps {
  /** The QueryClient that was used for SSR prefetching. */
  queryClient: QueryClient;
  children: ReactNode;
}

/**
 * Server Component helper. Dehydrates the prefetched QueryClient and renders
 * a HydrationBoundary so client components below see a pre-populated cache.
 *
 * Pattern in a page.tsx:
 *
 *   export default async function Page() {
 *     const queryClient = makeQueryClient();
 *     await Promise.all([
 *       queryClient.prefetchQuery({
 *         queryKey: queryKeys.recruiterJobs.list({}),
 *         queryFn: () => serverQueries.recruiterJobsList({}),
 *       }),
 *     ]);
 *     return (
 *       <PrefetchedHydration queryClient={queryClient}>
 *         <JobsListClient />
 *       </PrefetchedHydration>
 *     );
 *   }
 */
export function PrefetchedHydration({
  queryClient,
  children,
}: PrefetchedHydrationProps) {
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>
  );
}
