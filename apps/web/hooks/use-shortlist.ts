"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys, type RecruiterShortlistParams } from "@/lib/query";
import { clientApiFetch } from "./_client-fetch";

interface ShortlistResponse {
  data: unknown[];
  meta: { total: number };
}

export function useShortlistQuery(params: RecruiterShortlistParams) {
  return useQuery({
    queryKey: queryKeys.recruiterShortlist.list(params),
    queryFn: ({ signal }) =>
      clientApiFetch<ShortlistResponse>("/api/v1/applications/shortlist", {
        query: { page: params.page },
        signal,
      }),
  });
}
