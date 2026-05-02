import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";
import { JobDetail } from "@/components/jobs/job-detail";
import { getCurrentSession } from "@/lib/auth/session";
import { JobActions } from "./job-actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Job Detail" };

type JobDetailJob = Parameters<typeof JobDetail>[0]["job"];

export default async function RecruiterJobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/jobs/${id}/for-recruiter`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (res.status === 404) notFound();
  if (!res.ok) {
    return (
      <div className="text-[var(--color-status-danger)]">
        Failed to load job.
      </div>
    );
  }

  const body = (await res.json()) as { data: JobDetailJob };

  // Fetch applications count for this job
  let applicationsCount = 0;
  const appsRes = await fetch(`${apiUrl}/api/v1/applications/by-job/${id}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  if (appsRes.ok) {
    const appsBody = (await appsRes.json()) as { data: unknown[] };
    applicationsCount = appsBody.data.length;
  }

  return (
    <div className="mx-auto max-w-[1024px] space-y-6">
      <Link
        href="/recruiter/jobs"
        className="inline-block text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Back to all jobs
      </Link>
      <JobDetail
        job={body.data}
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
            <JobActions id={id} status={body.data.status} />
          </div>
        }
      />
    </div>
  );
}
