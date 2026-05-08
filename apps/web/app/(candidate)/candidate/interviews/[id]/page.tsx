import { notFound, redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";

import type { CandidateInterviewDetail } from "./_interview-detail-client";
import { CandidateInterviewDetailClient } from "./_interview-detail-client";

export const metadata = { title: "Interview · AuraHire" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CandidateInterviewDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/me/interviews/${id}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
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

  const body = (await res.json()) as { data: CandidateInterviewDetail };
  return <CandidateInterviewDetailClient interview={body.data} />;
}
