import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { JobDetail } from "@/components/jobs/job-detail";
import { getCurrentSession } from "@/lib/auth/session";
import { serverApiFetch, ServerApiError } from "@/lib/query/server";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Job Detail" };

type JobDetailJob = Parameters<typeof JobDetail>[0]["job"];

export default async function CandidateJobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  let job: JobDetailJob;
  try {
    const body = await serverApiFetch<{ data: JobDetailJob }>(
      `/api/v1/jobs/${id}/for-candidate`,
    );
    job = body.data;
  } catch (err) {
    if (err instanceof ServerApiError && err.status === 404) notFound();
    return (
      <div className="text-[var(--color-status-danger)]">Failed to load job.</div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <Link
        href="/candidate/jobs"
        className="inline-block text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Back to jobs
      </Link>
      <JobDetail
        job={job}
        actions={
          <Link
            href={`/candidate/jobs/${id}/apply`}
            className="inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 py-3 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
          >
            Apply Now
          </Link>
        }
      />
    </div>
  );
}
