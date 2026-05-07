import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { serverApiFetch, ServerApiError } from "@/lib/query/server";

import { RecruiterJobDetailView } from "./_detail-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Job Detail" };

type RecruiterJobDetail = Parameters<
  typeof RecruiterJobDetailView
>[0]["job"];

interface BiasFlagRow {
  id: string;
  term: string;
  category: string;
  severity: "high" | "medium" | "low" | null;
  explanation: string | null;
  suggestion: string | null;
  status: "flagged" | "overridden" | "resolved";
}

export default async function RecruiterJobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const [jobResult, appsResult, flagsResult] = await Promise.allSettled([
    serverApiFetch<{ data: RecruiterJobDetail }>(
      `/api/v1/jobs/${id}/for-recruiter`,
    ),
    serverApiFetch<{ data: unknown[] }>(`/api/v1/applications/by-job/${id}`),
    serverApiFetch<{ data: BiasFlagRow[] }>(`/api/v1/bias/jobs/${id}/flags`),
  ]);

  if (jobResult.status === "rejected") {
    if (
      jobResult.reason instanceof ServerApiError &&
      jobResult.reason.status === 404
    ) {
      notFound();
    }
    return (
      <div className="mx-auto max-w-[1280px]">
        <p className="text-sm text-[var(--color-status-danger)]">
          Failed to load job. Please refresh the page.
        </p>
      </div>
    );
  }

  const job = jobResult.value.data;
  const applicationsCount =
    appsResult.status === "fulfilled" ? appsResult.value.data.length : 0;
  const biasFlags: BiasFlagRow[] =
    flagsResult.status === "fulfilled" ? flagsResult.value.data : [];

  return (
    <RecruiterJobDetailView
      job={job}
      applicationsCount={applicationsCount}
      biasFlags={biasFlags}
    />
  );
}
