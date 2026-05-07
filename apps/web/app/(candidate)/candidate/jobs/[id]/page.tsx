import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { serverApiFetch, ServerApiError } from "@/lib/query/server";

import { CandidateJobDetailView } from "./_detail-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Job Detail" };

type CandidateJobDetail = Parameters<typeof CandidateJobDetailView>[0]["job"];

export default async function CandidateJobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  let job: CandidateJobDetail;
  try {
    const body = await serverApiFetch<{ data: CandidateJobDetail }>(
      `/api/v1/jobs/${id}/for-candidate`,
    );
    job = body.data;
  } catch (err) {
    if (err instanceof ServerApiError && err.status === 404) notFound();
    return (
      <div className="mx-auto max-w-[1280px]">
        <p className="text-sm text-[var(--color-status-danger)]">
          Failed to load job. Please refresh the page.
        </p>
      </div>
    );
  }

  // Look up whether this candidate has already applied to this job so the
  // detail page can swap the Apply CTA for "View your application".
  let existingApplicationId: string | null = null;
  try {
    const apps = await serverApiFetch<{
      data: Array<{ id: string; jobId: string }>;
    }>(`/api/v1/applications/mine`);
    existingApplicationId = apps.data.find((a) => a.jobId === id)?.id ?? null;
  } catch {
    existingApplicationId = null;
  }

  return (
    <CandidateJobDetailView
      job={job}
      applyHref={`/candidate/jobs/${id}/apply`}
      existingApplicationId={existingApplicationId}
    />
  );
}
