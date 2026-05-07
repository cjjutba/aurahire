// Server-only data helpers. Never import from a Client Component.
// Types and the ONBOARDING_STEPS constant live in `_steps.ts` (client-safe) and
// are re-exported here for convenience to existing callers.

import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import {
  type CandidateProfileMe,
  type LatestParsedResume,
  type ParsedResumeV2,
} from "./_steps";

// Re-export for back-compat — callers that imported types from _data.ts keep working.
export {
  ONBOARDING_STEPS,
  type OnboardingStepId,
  type CandidateProfileMe,
  type LatestParsedResume,
  type ParsedResumeV2,
} from "./_steps";

export async function fetchCandidateProfileMe(): Promise<CandidateProfileMe> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/candidate-profiles/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (res.status === 403) redirect("/login");
  if (!res.ok) throw new Error(`Failed to load candidate profile: ${res.status}`);

  const body = (await res.json()) as { data: CandidateProfileMe };
  return body.data;
}

export async function fetchLatestParsedResume(): Promise<LatestParsedResume | null> {
  const session = await getCurrentSession();
  if (!session) return null;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const listRes = await fetch(`${apiUrl}/api/v1/resumes/mine`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  if (!listRes.ok) return null;

  const listBody = (await listRes.json()) as {
    data: Array<{
      id: string;
      parseStatus: "pending" | "parsing" | "parsed" | "failed";
      parsedData: unknown;
      rawText: string | null;
      canonicalPdfPath: string | null;
      isDefault: boolean;
      createdAt: string;
    }>;
  };
  if (listBody.data.length === 0) return null;

  const sorted = [...listBody.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const candidate = sorted.find((r) => r.isDefault) ?? sorted[0]!;

  let signedPdfUrl: string | null = null;
  const urlRes = await fetch(`${apiUrl}/api/v1/resumes/${candidate.id}/download-url`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  if (urlRes.ok) {
    const urlBody = (await urlRes.json()) as { data: { signedUrl: string; signedPdfUrl: string } };
    signedPdfUrl = urlBody.data.signedPdfUrl ?? null;
  }

  return {
    id: candidate.id,
    parseStatus: candidate.parseStatus,
    signedPdfUrl,
    rawText: candidate.rawText,
    canonicalPdfPath: candidate.canonicalPdfPath,
    parsed: candidate.parsedData as ParsedResumeV2 | null,
  };
}
