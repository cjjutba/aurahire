"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { JobStatus } from "@aurahire/shared";

import { JobCard } from "@/components/jobs/job-card";
import type { CandidateJobsListParams } from "@/lib/query";
import { useCandidateJobsQuery } from "@/hooks/use-candidate-jobs";
import { useMyMatchPreviewsQuery } from "@/hooks/use-match-previews";

import { CandidateJobsToolbarClient } from "./_jobs-toolbar-client";
import { CandidateJobsPagination } from "./_jobs-pagination";

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
  params: CandidateJobsListParams & {
    page: number;
    limit: number;
    sort: string;
  };
  appliedJobMap?: Record<string, string>;
}

export function CandidateJobsListClient({
  params,
  appliedJobMap = {},
}: CandidateJobsListClientProps) {
  const { data, isLoading, isError } = useCandidateJobsQuery(params);

  const previews = useMyMatchPreviewsQuery();

  const previewsByJobId = useMemo(() => {
    const map = new Map<
      string,
      { overallScore: number; band: "strong" | "partial" | "limited" }
    >();
    for (const p of previews.data?.data ?? []) {
      map.set(p.jobId, { overallScore: p.overallScore, band: p.band });
    }
    return map;
  }, [previews.data]);

  if (isError) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <p className="text-sm text-[var(--color-status-danger)]">
          Failed to load jobs. Please refresh the page.
        </p>
      </div>
    );
  }

  const rows = (data?.data ?? []) as CandidateJobRow[];
  const meta = data?.meta ?? {
    page: params.page,
    limit: params.limit,
    total: 0,
    totalPages: 1,
  };
  const filtersActive = !!(params.q || params.mode || params.experienceLevel);

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          Browse Jobs
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          {(() => {
            if (isLoading) return "—";
            if (meta.total === 0) return "No jobs available";

            const base = `${meta.total} job${meta.total === 1 ? "" : "s"}`;

            // Hold the suffix until previews actually land — otherwise the
            // header advertises scoring before any chip renders below.
            const previewCount = previews.data?.data?.length ?? 0;
            if (!previews.isLoading && previewCount > 0) {
              return `${base} · auto-scored against your resume`;
            }
            return base;
          })()}
        </p>
      </header>

      {/* Toolbar */}
      <CandidateJobsToolbarClient
        initialQuery={params.q ?? ""}
        mode={params.mode ?? "all"}
        experienceLevel={params.experienceLevel ?? "all"}
        sort={params.sort}
        excludeApplied={!!params.excludeApplied}
      />

      {/* Grid or empty state */}
      {!isLoading && rows.length === 0 ? (
        filtersActive ? (
          <EmptyFiltered />
        ) : (
          <EmptyJobs />
        )
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                href={`/candidate/jobs/${job.id}`}
                applied={!!appliedJobMap[job.id]}
                matchPreview={previewsByJobId.get(job.id)}
                matchPreviewLoading={previews.isLoading}
              />
            ))}
          </div>
          <CandidateJobsPagination
            meta={{
              page: meta.page,
              limit: meta.limit,
              total: meta.total,
              totalPages:
                meta.totalPages ??
                Math.max(1, Math.ceil(meta.total / meta.limit)),
            }}
            searchParams={{
              q: params.q,
              mode: params.mode,
              experienceLevel: params.experienceLevel,
              sort: params.sort,
            }}
          />
        </>
      )}
    </div>
  );
}

function EmptyJobs() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No jobs available
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        New openings appear here as soon as recruiters publish them.
      </div>
    </div>
  );
}

function EmptyFiltered() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No jobs match your filters
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        Try different search terms or clear the filters.
      </div>
      <Link
        href="/candidate/jobs"
        className="mt-4 inline-flex h-9 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
      >
        Clear filters
      </Link>
    </div>
  );
}
