import { notFound, redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";

import type { AppDetail } from "./_application-detail-client";
import { ApplicationDetailDataClient } from "./_application-detail-data-client";

interface InterviewRow {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  format: string;
  status: string;
  locationOrLink: string | null;
}

interface OfferRow {
  id: string;
  status: string;
  title: string;
  salary: number;
  salaryCurrency: string;
  startDate: string;
  managerName: string | null;
  benefitsSummary: string | null;
  customMessage: string | null;
  expiresAt: string | null;
  sentAt: string;
  respondedAt: string | null;
}

export const metadata = { title: "Application Detail" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicationDetailPage({ params }: PageProps) {
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
      <div className="mx-auto max-w-[1280px] py-12 text-center">
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
  const pendingOffer = offers.find((o) => o.status === "pending") ?? null;
  const pastOffers = offers.filter((o) => o.status !== "pending");

  return (
    <ApplicationDetailDataClient
      applicationId={id}
      initialApp={app}
      initialInterviews={interviews}
      initialPendingOffer={pendingOffer}
      initialPastOffers={pastOffers}
    />
  );
}
