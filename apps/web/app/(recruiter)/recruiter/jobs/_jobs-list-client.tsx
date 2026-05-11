"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type { JobStatus } from "@aurahire/shared";

import type { RecruiterJobsListParams } from "@/lib/query";
import { useRecruiterJobsQuery } from "@/hooks/use-recruiter-jobs";
import { ClickableRow } from "@/components/ui/clickable-row";

import { JobsToolbarClient } from "./_jobs-toolbar-client";
import { JobsPagination } from "./_jobs-pagination";
import { JobRowActionsClient } from "./_jobs-row-actions-client";

interface JobWithStats {
  id: string;
  title: string;
  status: JobStatus;
  workMode: string;
  employmentType: string;
  experienceLevel: string;
  locationCity: string | null;
  locationCountry: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stats?: {
    candidates: number;
    new: number;
    interviewed: number;
    offered: number;
    hired: number;
    avgScore: number;
  };
}

const JOB_STATUS: Record<string, { label: string; dot: string; text: string }> =
  {
    draft: {
      label: "Draft",
      dot: "bg-[var(--color-muted)]",
      text: "text-[var(--color-muted)]",
    },
    published: {
      label: "Published",
      dot: "bg-[var(--color-status-success)]",
      text: "text-[var(--color-status-success)]",
    },
    closed: {
      label: "Closed",
      dot: "bg-[var(--color-status-danger)]",
      text: "text-[var(--color-status-danger)]",
    },
    archived: {
      label: "Archived",
      dot: "bg-[var(--color-muted)]",
      text: "text-[var(--color-muted)]",
    },
  };

const DEFAULT_JOB_STATUS = JOB_STATUS["draft"]!;

function getJobStatus(s: string) {
  return JOB_STATUS[s] ?? DEFAULT_JOB_STATUS;
}

function formatSalary(value: number | null): string {
  if (value == null) return "";
  return value.toLocaleString();
}

function formatSalaryRange(
  min: number | null,
  max: number | null,
  currency: string | null,
) {
  if (min == null && max == null)
    return <span className="text-[var(--color-muted)]">-</span>;
  const cur = currency ?? "USD";
  if (min != null && max != null)
    return `${formatSalary(min)}-${formatSalary(max)} ${cur}`;
  if (min != null) return `From ${formatSalary(min)} ${cur}`;
  return `Up to ${formatSalary(max)} ${cur}`;
}

function formatLocation(city: string | null, country: string | null) {
  const parts = [city, country].filter(Boolean);
  return parts.length === 0 ? (
    <span className="text-[var(--color-muted)]">-</span>
  ) : (
    parts.join(", ")
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface JobsListClientProps {
  params: RecruiterJobsListParams & {
    page: number;
    limit: number;
    sort: string;
  };
}

export function JobsListClient({ params }: JobsListClientProps) {
  const { data, isError } = useRecruiterJobsQuery(params);

  if (isError) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <p className="text-sm text-[var(--color-status-danger)]">
          Failed to load jobs. Please refresh the page.
        </p>
      </div>
    );
  }

  const rows = (data?.data ?? []) as JobWithStats[];
  const meta = data?.meta ?? {
    page: params.page,
    limit: params.limit,
    total: 0,
    totalPages: 1,
  };
  const filtersActive = !!(
    params.q ||
    params.status ||
    params.mode ||
    params.experienceLevel
  );

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
            My Jobs
          </h1>
          <p className="mt-2 text-sm text-[var(--color-body)]">
            {meta.total === 0
              ? "No jobs yet"
              : `${meta.total} job${meta.total === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link
          href="/recruiter/jobs/new"
          className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          <Plus className="h-4 w-4" />
          New Job
        </Link>
      </header>

      {/* Toolbar */}
      <JobsToolbarClient
        initialQuery={params.q ?? ""}
        status={params.status ?? "all"}
        mode={params.mode ?? "all"}
        experienceLevel={params.experienceLevel ?? "all"}
        sort={params.sort}
      />

      {/* Table or empty state */}
      {rows.length === 0 ? (
        filtersActive ? (
          <EmptyFiltered />
        ) : (
          <EmptyJobs />
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Type / Mode
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Location
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Salary
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Apps
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Updated
                  </th>
                  <th className="w-10 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline-soft)]">
                {rows.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </tbody>
            </table>
          </div>
          <JobsPagination
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
              status: params.status,
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

function JobRow({ job }: { job: JobWithStats }) {
  const status = getJobStatus(job.status);
  const apps = job.stats?.candidates ?? 0;
  return (
    <ClickableRow
      href={`/recruiter/jobs/${job.id}`}
      ariaLabel={`Open ${job.title}`}
    >
      <td className="px-4 py-3">
        <Link
          href={`/recruiter/jobs/${job.id}`}
          className="font-medium text-[var(--color-ink)] hover:underline"
        >
          {job.title}
        </Link>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${status.text}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
            aria-hidden
          />
          {status.label}
        </span>
      </td>
      <td className="px-4 py-3 text-[var(--color-body)]">
        <span className="capitalize">{job.employmentType}</span>
        <span className="text-[var(--color-muted)]"> · </span>
        <span className="capitalize">{job.workMode}</span>
      </td>
      <td className="px-4 py-3 text-[var(--color-body)]">
        {formatLocation(job.locationCity, job.locationCountry)}
      </td>
      <td className="px-4 py-3 text-right font-mono text-[var(--color-body)]">
        {formatSalaryRange(job.salaryMin, job.salaryMax, job.salaryCurrency)}
      </td>
      <td className="px-4 py-3 text-right font-mono text-[var(--color-ink)]">
        {apps}
      </td>
      <td className="px-4 py-3 text-[var(--color-muted)]">
        {formatDate(job.updatedAt)}
      </td>
      <td className="px-2 py-3 text-right">
        <JobRowActionsClient jobId={job.id} status={job.status} />
      </td>
    </ClickableRow>
  );
}

function EmptyJobs() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No jobs yet
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        Post your first opening to start collecting candidates.
      </div>
      <Link
        href="/recruiter/jobs/new"
        className="mt-4 inline-flex h-11 items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
      >
        + Create your first job
      </Link>
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
        href="/recruiter/jobs"
        className="mt-4 inline-flex h-9 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
      >
        Clear filters
      </Link>
    </div>
  );
}
