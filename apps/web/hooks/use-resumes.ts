"use client";

import { useQuery } from "@tanstack/react-query";
import type { ParsedResume } from "@aurahire/shared";

import { queryKeys } from "@/lib/query";
import { clientApiFetch } from "./_client-fetch";

export interface ResumeRow {
  id: string;
  candidateId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  canonicalPdfPath: string | null;
  rawText: string | null;
  parsedData: ParsedResume | null;
  parseStatus: "pending" | "parsing" | "parsed" | "failed";
  parseError: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ResumeListResponse {
  data: ResumeRow[];
}

interface SignedUrlResponse {
  data: {
    signedUrl: string;
    signedPdfUrl: string;
    expiresAt: string;
  };
}

export function useMyResumesQuery() {
  return useQuery({
    queryKey: queryKeys.candidateResumes.list(),
    queryFn: ({ signal }) =>
      clientApiFetch<ResumeListResponse>("/api/v1/resumes/mine", { signal }),
  });
}

export function useResumeSignedUrlQuery(resumeId: string | null) {
  return useQuery({
    queryKey: queryKeys.candidateResumes.download(resumeId ?? "none"),
    queryFn: ({ signal }) =>
      clientApiFetch<SignedUrlResponse>(
        `/api/v1/resumes/${resumeId}/download`,
        { signal },
      ),
    enabled: Boolean(resumeId),
    // Signed URLs are valid for 1 hour. Cache for ~50 minutes.
    staleTime: 50 * 60_000,
    gcTime: 50 * 60_000,
  });
}
