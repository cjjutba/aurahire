"use client";

import { useQuery } from "@tanstack/react-query";

import { clientApiFetch } from "./_client-fetch";

interface MatchPreviewListItem {
  id: string;
  jobId: string;
  resumeId: string;
  overallScore: number;
  band: "strong" | "partial" | "limited";
  source: "system" | "candidate";
  createdAt: string;
  job: {
    id: string;
    title: string;
    company: { id: string; name: string; logoUrl: string | null } | null;
  } | null;
}

interface MatchPreviewsResponse {
  data: MatchPreviewListItem[];
}

export function useMyMatchPreviewsQuery() {
  return useQuery({
    queryKey: ["candidate-match-previews", "list"] as const,
    queryFn: ({ signal }) =>
      clientApiFetch<MatchPreviewsResponse>("/api/v1/scoring/match-previews", {
        signal,
      }),
  });
}

export type { MatchPreviewListItem };
