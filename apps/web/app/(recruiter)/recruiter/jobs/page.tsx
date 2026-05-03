import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import type { JobStatus } from "@aurahire/shared";
import { JobListRow } from "@/components/jobs/job-list-row";
import { EmptyState } from "@/components/empty-state";
import { getCurrentSession } from "@/lib/auth/session";

export const metadata = { title: "My Jobs" };

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

interface RecruiterJobRow {
  id: string;
  title: string;
  department: string | null;
  employmentType: string;
  workMode: string;
  locationCity: string | null;
  locationCountry: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  status: JobStatus;
  publishedAt: string | null;
  company: { name: string };
}

export default async function RecruiterJobsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const url = new URL(`${apiUrl}/api/v1/jobs/mine`);
  if (sp.status && sp.status !== "all") url.searchParams.set("status", sp.status);
  if (sp.page) url.searchParams.set("page", sp.page);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="text-[var(--color-status-danger)]">
        Failed to load jobs.
      </div>
    );
  }

  const body = (await res.json()) as {
    data: RecruiterJobRow[];
    meta: { total: number };
  };

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
            My Jobs
          </h1>
          <p className="mt-1 text-sm text-[var(--color-body)]">
            {body.meta.total} job{body.meta.total === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/recruiter/jobs/new"
          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
        >
          <Plus className="h-4 w-4" />
          New Job
        </Link>
      </header>

      {body.data.length === 0 ? (
        <EmptyState
          headline="Post your first job"
          description="Create a job posting and start receiving applications."
          cta={{ href: "/recruiter/jobs/new", label: "New Job" }}
        />
      ) : (
        <div className="space-y-3">
          {body.data.map((job) => (
            <JobListRow
              key={job.id}
              job={job}
              href={`/recruiter/jobs/${job.id}`}
              showStatus
            />
          ))}
        </div>
      )}
    </div>
  );
}
