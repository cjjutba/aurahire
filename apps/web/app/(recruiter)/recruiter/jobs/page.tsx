import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Briefcase } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import { JobsToolbar } from "./_jobs-toolbar-client";
import { JobRowActions } from "./_jobs-row-actions-client";
import { JobsPagination } from "./_jobs-pagination";

export const metadata = { title: "My Jobs" };

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobStats {
  candidates: number;
  new: number;
  interviewed: number;
  offered: number;
  hired: number;
  avgScore: number;
}

interface RecruiterJob {
  id: string;
  title: string;
  status: string;
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
  stats?: JobStats;
}

interface JobsMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Status pill ──────────────────────────────────────────────────────────────

const JOB_STATUS = {
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
} as const;

const DEFAULT_JOB_STATUS = JOB_STATUS.draft;

function getJobStatus(s: string) {
  return JOB_STATUS[s as keyof typeof JOB_STATUS] ?? DEFAULT_JOB_STATUS;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatSalaryValue(value: number): string {
  return value.toLocaleString();
}

function formatSalaryRange(
  min: number | null,
  max: number | null,
  currency: string | null,
): React.ReactNode {
  if (min == null && max == null)
    return <span className="text-[var(--color-muted)]">—</span>;
  const cur = currency ?? "USD";
  if (min != null && max != null)
    return `${formatSalaryValue(min)}–${formatSalaryValue(max)} ${cur}`;
  if (min != null) return `From ${formatSalaryValue(min)} ${cur}`;
  return `Up to ${formatSalaryValue(max!)} ${cur}`;
}

function formatLocation(
  city: string | null,
  country: string | null,
): React.ReactNode {
  const parts = [city, country].filter(Boolean);
  return parts.length === 0 ? (
    <span className="text-[var(--color-muted)]">—</span>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function RecruiterJobsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const sp = await searchParams;

  const q = sp.q ?? "";
  const status = sp.status ?? "all";
  const mode = sp.mode ?? "all";
  const experienceLevel = sp.experienceLevel ?? "all";
  const sort = sp.sort ?? "recent";
  const page = Number(sp.page ?? 1);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const url = new URL(`${apiUrl}/api/v1/jobs/mine`);

  if (q) url.searchParams.set("q", q);
  if (status !== "all") url.searchParams.set("status", status);
  if (mode !== "all") url.searchParams.set("mode", mode);
  if (experienceLevel !== "all")
    url.searchParams.set("experienceLevel", experienceLevel);
  if (sort && sort !== "recent") url.searchParams.set("sort", sort);
  if (page > 1) url.searchParams.set("page", String(page));
  url.searchParams.set("include", "stats");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-status-danger)] bg-[var(--color-canvas)] p-6 text-sm text-[var(--color-status-danger)]">
          Failed to load jobs. Please refresh the page.
        </div>
      </div>
    );
  }

  const body = (await res.json()) as {
    data: RecruiterJob[];
    meta: JobsMeta;
  };

  const jobs = body.data;
  const meta = body.meta;

  const hasFilters = !!(q || (status !== "all") || (mode !== "all") || (experienceLevel !== "all"));

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
            My Jobs
          </h1>
          <p className="mt-1 text-sm text-[var(--color-body)]">
            {meta.total === 0
              ? "No jobs yet"
              : `${meta.total} job${meta.total === 1 ? "" : "s"}`}
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

      {/* Toolbar */}
      <JobsToolbar
        initialQuery={q}
        initialStatus={status}
        initialMode={mode}
        initialExperience={experienceLevel}
        initialSort={sort}
      />

      {/* Table or empty state */}
      {jobs.length === 0 ? (
        hasFilters ? (
          <FilteredEmptyState />
        ) : (
          <TrulyEmptyState />
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
            <table className="w-full border-collapse text-sm">
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
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline-soft)]">
                {jobs.map((job) => {
                  const statusMeta = getJobStatus(job.status);
                  return (
                    <tr
                      key={job.id}
                      className="transition hover:bg-[var(--color-surface-soft)]"
                    >
                      {/* Title */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/recruiter/jobs/${job.id}`}
                          className="font-medium text-[var(--color-ink)] hover:underline"
                        >
                          {job.title}
                        </Link>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${statusMeta.text}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`}
                            aria-hidden
                          />
                          {statusMeta.label}
                        </span>
                      </td>

                      {/* Type / Mode */}
                      <td className="px-4 py-3 text-[var(--color-body)]">
                        {capitalize(job.employmentType)} ·{" "}
                        {capitalize(job.workMode)}
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3 text-[var(--color-body)]">
                        {formatLocation(job.locationCity, job.locationCountry)}
                      </td>

                      {/* Salary */}
                      <td className="px-4 py-3 text-right font-mono text-[var(--color-body)]">
                        {formatSalaryRange(
                          job.salaryMin,
                          job.salaryMax,
                          job.salaryCurrency,
                        )}
                      </td>

                      {/* Apps */}
                      <td className="px-4 py-3 text-right font-mono text-[var(--color-ink)]">
                        {job.stats?.candidates ?? 0}
                      </td>

                      {/* Updated */}
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {formatDate(job.updatedAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <JobRowActions id={job.id} status={job.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <JobsPagination meta={meta} searchParams={sp} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function TrulyEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] py-20">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-strong)]">
        <Briefcase className="h-6 w-6 text-[var(--color-muted)]" aria-hidden />
      </div>
      <h2 className="mt-4 text-base font-semibold text-[var(--color-ink)]">
        No jobs yet
      </h2>
      <p className="mt-1 max-w-xs text-center text-sm text-[var(--color-muted)]">
        Post your first opening to start collecting candidates.
      </p>
      <Link
        href="/recruiter/jobs/new"
        className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
      >
        <Plus className="h-4 w-4" />
        Create your first job
      </Link>
    </div>
  );
}

function FilteredEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] py-20">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-strong)]">
        <Briefcase className="h-6 w-6 text-[var(--color-muted)]" aria-hidden />
      </div>
      <h2 className="mt-4 text-base font-semibold text-[var(--color-ink)]">
        No jobs match your filters
      </h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Try adjusting your search or filters.
      </p>
      <Link
        href="/recruiter/jobs"
        className="mt-4 text-sm font-medium text-[var(--color-primary)] hover:underline"
      >
        Clear filters
      </Link>
    </div>
  );
}
