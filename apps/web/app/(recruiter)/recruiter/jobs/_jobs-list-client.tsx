"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type { JobStatus } from "@aurahire/shared";

import { JobListRow } from "@/components/jobs/job-list-row";
import { EmptyState } from "@/components/empty-state";
import { useRecruiterJobsQuery } from "@/hooks/use-recruiter-jobs";

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

interface JobsListClientProps {
  status?: string;
  page?: number;
}

export function JobsListClient({ status, page }: JobsListClientProps) {
  const { data, isLoading, isError } = useRecruiterJobsQuery({ status, page });

  if (isError) {
    return (
      <div className="text-[var(--color-status-danger)]">Failed to load jobs.</div>
    );
  }

  const rows = (data?.data ?? []) as RecruiterJobRow[];
  const total = data?.meta?.total ?? 0;

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
            My Jobs
          </h1>
          <p className="mt-1 text-sm text-[var(--color-body)]">
            {isLoading ? "—" : `${total} job${total === 1 ? "" : "s"}`}
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

      {!isLoading && rows.length === 0 ? (
        <EmptyState
          headline="Post your first job"
          description="Create a job posting and start receiving applications."
          cta={{ href: "/recruiter/jobs/new", label: "New Job" }}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((job) => (
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
