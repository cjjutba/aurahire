"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query";
import { clientApiFetch } from "./_client-fetch";

export function useProfileScoreQuery() {
  return useQuery({
    queryKey: queryKeys.profileScore.me(),
    queryFn: ({ signal }) =>
      clientApiFetch<unknown>("/api/v1/scoring/profile/me", { signal }),
  });
}
