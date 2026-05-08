import { notFound, redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";

import {
  RecruiterInterviewDetailClient,
  type InterviewDetail,
  type SiblingInterview,
} from "./_interview-detail-client";

export const metadata = { title: "Interview · AuraHire" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RecruiterInterviewDetailPage({
  params,
}: PageProps) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const authHeaders = { Authorization: `Bearer ${session.access_token}` };

  const res = await fetch(`${apiUrl}/api/v1/interviews/${id}`, {
    headers: authHeaders,
    cache: "no-store",
  });

  if (res.status === 404) notFound();
  if (!res.ok) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <p className="text-sm text-[var(--color-status-danger)]">
          Failed to load interview.
        </p>
      </div>
    );
  }

  const body = (await res.json()) as { data: InterviewDetail };
  const interview = body.data;

  // Fetch sibling interviews for the same application to show the chain.
  let siblings: SiblingInterview[] = [];
  if (interview.applicationId) {
    const siblingsRes = await fetch(
      `${apiUrl}/api/v1/applications/${interview.applicationId}/interviews`,
      { headers: authHeaders, cache: "no-store" },
    );
    if (siblingsRes.ok) {
      const siblingsBody = (await siblingsRes.json()) as {
        data: InterviewDetail[];
      };
      siblings = siblingsBody.data
        .filter((s) => s.id !== id)
        .map((s) => ({
          id: s.id,
          scheduledAt: s.scheduledAt,
          durationMinutes: s.durationMinutes,
          status: s.status,
          venueName: s.venueName ?? null,
          addressLine: s.addressLine ?? null,
        }));
    }
  }

  return (
    <RecruiterInterviewDetailClient
      interview={{ ...interview, siblings }}
    />
  );
}
