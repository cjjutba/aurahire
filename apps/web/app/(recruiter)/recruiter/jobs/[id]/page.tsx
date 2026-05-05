import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";
import { JobDetail } from "@/components/jobs/job-detail";
import { getCurrentSession } from "@/lib/auth/session";
import { BiasFlagsList } from "@/components/bias/bias-flags-list";
import { serverApiFetch, ServerApiError } from "@/lib/query/server";
import { JobActions } from "./job-actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Job Detail" };

type JobDetailJob = Parameters<typeof JobDetail>[0]["job"];

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
  const { id } = (await params);
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const [jobResult, appsResult, flagsResult] = await Promise.allSettled([
    serverApiFetch<{ data: JobDetailJob }>(`/api/v1/jobs/${id}/for-recruiter`),
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
      <div className="text-[var(--color-status-danger)]">
        Failed to load job.
      </div>
    );
  }

  const job = jobResult.value.data;
  const applicationsCount =
    appsResult.status === "fulfilled" ? appsResult.value.data.length : 0;
  const biasFlags: BiasFlagRow[] =
    flagsResult.status === "fulfilled" ? flagsResult.value.data : [];

  return (
    <div className="mx-auto max-w-[1024px] space-y-6">
      <Link
        href="/recruiter/jobs"
        className="inline-block text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Back to all jobs
      </Link>
      <JobDetail
        job={job}
        showStatusChip
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/recruiter/jobs/${id}/applications`}
              className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-strong)]"
            >
              Applications
              <span className="ml-1 rounded-[var(--radius-pill)] bg-[var(--color-primary-soft)] px-2 font-mono text-xs text-[var(--color-primary)]">
                {applicationsCount}
              </span>
            </Link>
            <Link
              href={`/recruiter/jobs/${id}/edit`}
              className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-strong)]"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Link>
            <JobActions id={id} status={job.status} />
          </div>
        }
      />

      {biasFlags.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Bias Check Results
          </h2>
          <BiasFlagsList
            flags={biasFlags.map((f) => ({
              id: f.id,
              term: f.term,
              category: f.category,
              severity: f.severity,
              explanation: f.explanation,
              suggestion: f.suggestion,
              status: f.status,
            }))}
            title={`${biasFlags.length} historical flag${biasFlags.length === 1 ? "" : "s"}`}
          />
        </section>
      )}
    </div>
  );
}
