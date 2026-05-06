"use client";

import type { JobStatus } from "@aurahire/shared";

import { JobListRow } from "@/components/jobs/job-list-row";
import { JobFilters } from "@/components/jobs/job-filters";
import { EmptyState } from "@/components/empty-state";
import { useCandidateJobsQuery } from "@/hooks/use-candidate-jobs";

interface CandidateJobRow {
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
  company: { name: string; logoUrl: string | null };
}

interface CandidateJobsListClientProps {
  q?: string;
  mode?: string;
  experienceLevel?: string;
  page?: number;
}

export function CandidateJobsListClient({
  q,
  mode,
  experienceLevel,
  page,
}: CandidateJobsListClientProps) {
  const { data, isLoading, isError } = useCandidateJobsQuery({ q, mode, experienceLevel, page });

  if (isError) {
    return <div className="text-[var(--color-status-danger)]">Failed to load jobs.</div>;
  }

  const rows = (data?.data ?? []) as CandidateJobRow[];
  const total = data?.meta?.total ?? 0;

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Browse Jobs
        </h1>
        <p className="mt-1 text-sm text-[var(--color-body)]">
          {isLoading ? "—" : `${total} jobs · match scoring arrives in a future slice`}
        </p>
      </header>
      <JobFilters />
      <div className="space-y-3">
        {!isLoading && rows.length === 0 ? (
          <EmptyState
            headline="No jobs match your filters yet"
            description="Try clearing your filters or browse all available roles."
            cta={{ href: "/candidate/jobs", label: "Browse all" }}
          />
        ) : (
          rows.map((job) => (
            <JobListRow key={job.id} job={job} href={`/candidate/jobs/${job.id}`} />
          ))
        )}
      </div>
    </div>
  );
}
