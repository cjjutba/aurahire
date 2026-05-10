import { notFound, redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";

import {
  RecruiterApplicationDetailClient,
  type AppDetail,
} from "./_application-detail-client";
import type { InterviewRow } from "./_interviews-section-client";
import type { OfferRow } from "./_offers-section";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Application Review · AuraHire" };

export default async function RecruiterApplicationDetailPage({
  params,
}: PageProps) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const authHeaders = { Authorization: `Bearer ${session.access_token}` };

  const [res, interviewsRes, offersRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/applications/${id}`, {
      headers: authHeaders,
      cache: "no-store",
    }),
    fetch(`${apiUrl}/api/v1/applications/${id}/interviews`, {
      headers: authHeaders,
      cache: "no-store",
    }),
    fetch(`${apiUrl}/api/v1/applications/${id}/offers`, {
      headers: authHeaders,
      cache: "no-store",
    }),
  ]);

  if (res.status === 404) notFound();
  if (!res.ok) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <p className="text-sm text-[var(--color-status-danger)]">
          Failed to load application.
        </p>
      </div>
    );
  }

  const body = (await res.json()) as { data: AppDetail };
  const app = body.data;

  const interviews: InterviewRow[] = interviewsRes.ok
    ? ((await interviewsRes.json()) as { data: InterviewRow[] }).data
    : [];
  const offers: OfferRow[] = offersRes.ok
    ? ((await offersRes.json()) as { data: OfferRow[] }).data
    : [];

  return (
    <RecruiterApplicationDetailClient
      app={app}
      interviews={interviews}
      offers={offers}
    />
  );
}
