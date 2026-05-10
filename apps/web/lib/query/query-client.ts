import {
  QueryClient,
  defaultShouldDehydrateQuery,
} from "@tanstack/react-query";

/**
 * Single source of truth for QueryClient configuration. Used by both:
 *   - the client-side QueryProvider (one singleton per browser session)
 *   - Server Components that prefetch + dehydrate (a fresh instance per request)
 *
 * `staleTime: 60_000` matches the typical backend hot-tier TTL — the client
 * trusts hydrated data for one minute before refetching in the background.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const status = (error as { response?: { status?: number } })?.response
            ?.status;
          if (status === 401 || status === 403 || status === 404) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: 0,
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) &&
          query.state.status === "success",
      },
    },
  });
}
