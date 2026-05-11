import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";

import { getCurrentSession } from "@/lib/auth/session";
import { EmptyState } from "@/components/empty-state";
import { ClickableRow } from "@/components/ui/clickable-row";

import { InterviewsToolbarClient } from "./_interviews-toolbar-client";
import { InterviewsPagination } from "./_interviews-pagination";
import { RecruiterInterviewRowActionsClient } from "./_row-actions-client";

export const metadata = { title: "Interviews" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface InterviewRow {
  id: string;
  applicationId: string;
  scheduledAt: string;
  durationMinutes: number;
  format: string;
  locationOrLink: string | null;
  status: string;
  candidate: { id: string; fullName: string; email: string } | null;
  job: { id: string; title: string } | null;
}

interface InterviewsEnvelope {
  data: InterviewRow[];
  meta: PaginationMeta;
}

// ---------------------------------------------------------------------------
// Status pill helpers
// ---------------------------------------------------------------------------

type StatusEntry = { label: string; dot: string; text: string };

const INTERVIEW_STATUS_STYLES: Record<string, StatusEntry> = {
  scheduled: {
    label: "Scheduled",
    dot: "bg-[var(--color-status-info)]",
    text: "text-[var(--color-status-info)]",
  },
  completed: {
    label: "Completed",
    dot: "bg-[var(--color-status-success)]",
    text: "text-[var(--color-status-success)]",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-[var(--color-status-danger)]",
    text: "text-[var(--color-status-danger)]",
  },
  "no-show": {
    label: "No-show",
    dot: "bg-[var(--color-status-warning)]",
    text: "text-[var(--color-status-warning)]",
  },
};

const DEFAULT_STATUS: StatusEntry = {
  label: "Scheduled",
  dot: "bg-[var(--color-status-info)]",
  text: "text-[var(--color-status-info)]",
};

function getStatusStyle(s: string): StatusEntry {
  return INTERVIEW_STATUS_STYLES[s] ?? DEFAULT_STATUS;
}

// ---------------------------------------------------------------------------
// Format label helper
// ---------------------------------------------------------------------------

const FORMAT_LABELS: Record<string, string> = {
  phone: "Phone",
  video: "Video",
  "in-person": "In-Person",
};

function formatLabel(f: string): string {
  return FORMAT_LABELS[f] ?? f;
}

// ---------------------------------------------------------------------------
// Avatar helper
// ---------------------------------------------------------------------------

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ---------------------------------------------------------------------------
// Date / time formatters
// ---------------------------------------------------------------------------

function formatDateLine(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    format?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function RecruiterInterviewsPage({
  searchParams,
}: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status ?? "";
  const format = sp.format ?? "";
  const sort = sp.sort ?? "upcoming";
  const page = sp.page ? Math.max(1, Number(sp.page)) : 1;
  const limit = 25;

  const apiParams = new URLSearchParams();
  if (q) apiParams.set("q", q);
  if (status) apiParams.set("status", status);
  if (format) apiParams.set("format", format);
  if (sort) apiParams.set("sort", sort);
  apiParams.set("page", String(page));
  apiParams.set("limit", String(limit));

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(
    `${apiUrl}/api/v1/interviews/by-recruiter/me?${apiParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    return (
      <div className="mx-auto max-w-[1280px] space-y-6">
        <header>
          <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
            Interviews
          </h1>
        </header>
        <p className="text-sm text-[var(--color-status-danger)]">
          Failed to load interviews. Please refresh the page.
        </p>
      </div>
    );
  }

  const body = (await res.json()) as InterviewsEnvelope;
  const rows = body.data;
  const meta = body.meta;

  const filterParams = new URLSearchParams();
  if (q) filterParams.set("q", q);
  if (status) filterParams.set("status", status);
  if (format) filterParams.set("format", format);
  if (sort && sort !== "upcoming") filterParams.set("sort", sort);

  const hasFilters = !!(q || status || format);

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          Interviews
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          {meta.total === 0
            ? "Schedule and track interviews with shortlisted candidates."
            : `${meta.total} interview${meta.total === 1 ? "" : "s"} · Schedule and track interviews with shortlisted candidates.`}
        </p>
      </header>

      {/* Toolbar */}
      <InterviewsToolbarClient
        q={q}
        status={status}
        format={format}
        sort={sort}
      />

      {/* Table or empty state */}
      {rows.length === 0 ? (
        hasFilters ? (
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] py-16 px-6 text-center">
            <h3 className="text-lg font-semibold text-[var(--color-ink)]">
              No interviews match your filters
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-body)]">
              Try different search terms or filters.
            </p>
            <div className="mt-6">
              <Link
                href="/recruiter/interviews"
                className="inline-flex items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-6 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
              >
                Clear filters
              </Link>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<CalendarClock className="h-6 w-6" />}
            headline="No interviews scheduled"
            description="Open an application from your job's pipeline to schedule an interview."
            cta={{ href: "/recruiter/jobs", label: "View jobs →" }}
          />
        )
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)]">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Candidate
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Job
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  When
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Format
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Status
                </th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const statusStyle = getStatusStyle(row.status);
                const candidateName = row.candidate?.fullName ?? "Unknown";
                const candidateInitials = initials(candidateName);
                const when = formatDateLine(row.scheduledAt);
                return (
                  <ClickableRow
                    key={row.id}
                    href={`/recruiter/applications/${row.applicationId}`}
                    ariaLabel={`Open application for ${candidateName}'s interview`}
                    className={`border-b border-[var(--color-hairline-soft)] ${
                      idx === rows.length - 1 ? "border-b-0" : ""
                    }`}
                  >
                    {/* Candidate */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          aria-hidden
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-xs font-semibold text-[var(--color-ink)]"
                        >
                          {candidateInitials}
                        </div>
                        <div className="min-w-0">
                          <span className="block truncate font-medium text-[var(--color-ink)]">
                            {candidateName}
                          </span>
                          {row.candidate?.email && (
                            <p className="truncate text-xs text-[var(--color-muted)]">
                              {row.candidate.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Job */}
                    <td className="px-4 py-3 text-[var(--color-body)]">
                      {row.job?.title ?? "-"}
                    </td>

                    {/* When */}
                    <td className="px-4 py-3">
                      <div className="text-[var(--color-ink)]">{when.date}</div>
                      <div className="font-mono text-xs text-[var(--color-muted)]">
                        {when.time}
                      </div>
                    </td>

                    {/* Format */}
                    <td className="px-4 py-3 text-[var(--color-body)]">
                      {formatLabel(row.format)}
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-3 text-right font-mono text-[var(--color-body)]">
                      {row.durationMinutes} min
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-hairline-soft)] bg-[var(--color-surface-soft)] px-2.5 py-1 text-xs font-medium ${statusStyle.text}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`}
                        />
                        {statusStyle.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-3 text-right">
                      <RecruiterInterviewRowActionsClient
                        applicationId={row.applicationId}
                        jobId={row.job?.id ?? null}
                      />
                    </td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <InterviewsPagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={meta.limit}
          queryString={filterParams.toString()}
        />
      )}
    </div>
  );
}
