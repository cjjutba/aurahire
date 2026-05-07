"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Building2, ChevronRight, FileText } from "lucide-react";

import { useMyInterviewsQuery } from "@/hooks/use-interviews";

import { CandidateInterviewsToolbarClient } from "./_interviews-toolbar-client";
import { CandidateInterviewsPagination } from "./_interviews-pagination";

interface InterviewRow {
  id: string;
  applicationId: string;
  scheduledAt: string;
  durationMinutes: number;
  format: string;
  locationOrLink: string | null;
  status: string;
  job?: { id: string; title: string } | null;
  company?: { id: string; name: string; logoUrl: string | null } | null;
}

const STATUS_STYLES: Record<string, { label: string; dot: string; text: string }> = {
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

const DEFAULT_STATUS = STATUS_STYLES["scheduled"]!;

function getStatusStyle(s: string) {
  return STATUS_STYLES[s] ?? DEFAULT_STATUS;
}

const FORMAT_LABELS: Record<string, string> = {
  phone: "Phone",
  video: "Video",
  "in-person": "In-Person",
};

function formatLabel(f: string): string {
  return FORMAT_LABELS[f] ?? f;
}

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

interface CandidateInterviewsClientProps {
  params: {
    q?: string;
    status?: string;
    format?: string;
    sort: string;
    page: number;
    limit: number;
  };
}

export function CandidateInterviewsClient({ params }: CandidateInterviewsClientProps) {
  const { data, isError } = useMyInterviewsQuery({});

  const all = useMemo(
    () => (data?.data ?? []) as InterviewRow[],
    [data?.data],
  );

  const filtered = useMemo(() => {
    let rows = [...all];

    if (params.q) {
      const needle = params.q.toLowerCase();
      rows = rows.filter((r) => {
        const title = r.job?.title?.toLowerCase() ?? "";
        const company = r.company?.name?.toLowerCase() ?? "";
        return title.includes(needle) || company.includes(needle);
      });
    }
    if (params.status) {
      rows = rows.filter((r) => r.status === params.status);
    }
    if (params.format) {
      rows = rows.filter((r) => r.format === params.format);
    }

    // Snapshot wall-clock once so the comparator stays stable across the sort.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();

    rows.sort((a, b) => {
      const ta = new Date(a.scheduledAt).getTime();
      const tb = new Date(b.scheduledAt).getTime();
      switch (params.sort) {
        case "earliest":
          return ta - tb;
        case "recent":
          return tb - ta;
        case "upcoming":
        default: {
          // upcoming first (chronological from soonest), then past (most recent first)
          const aFuture = ta >= now;
          const bFuture = tb >= now;
          if (aFuture && !bFuture) return -1;
          if (!aFuture && bFuture) return 1;
          if (aFuture) return ta - tb;
          return tb - ta;
        }
      }
    });

    return rows;
  }, [all, params.q, params.status, params.format, params.sort]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  const safePage = Math.min(params.page, totalPages);
  const startIdx = (safePage - 1) * params.limit;
  const rows = filtered.slice(startIdx, startIdx + params.limit);

  if (isError) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <p className="text-sm text-[var(--color-status-danger)]">
          Failed to load interviews. Please refresh the page.
        </p>
      </div>
    );
  }

  const filtersActive = !!(params.q || params.status || params.format);

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
            Interviews
          </h1>
          <p className="mt-2 text-sm text-[var(--color-body)]">
            {all.length === 0
              ? "Your scheduled interviews and history."
              : `${all.length} interview${all.length === 1 ? "" : "s"} · Your scheduled interviews and history.`}
          </p>
        </div>
        <Link
          href="/candidate/applications"
          className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          <FileText className="h-4 w-4" />
          View Applications
        </Link>
      </header>

      {/* Toolbar */}
      <CandidateInterviewsToolbarClient
        initialQuery={params.q ?? ""}
        status={params.status ?? "all"}
        format={params.format ?? "all"}
        sort={params.sort}
      />

      {/* Table or empty state */}
      {rows.length === 0 ? (
        filtersActive ? <EmptyFiltered /> : <EmptyInterviews />
      ) : (
        <>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Interview
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
                  <th className="w-10 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline-soft)]">
                {rows.map((row) => (
                  <InterviewRowEl key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
          <CandidateInterviewsPagination
            meta={{
              page: safePage,
              limit: params.limit,
              total,
              totalPages,
            }}
            searchParams={{
              q: params.q,
              status: params.status,
              format: params.format,
              sort: params.sort,
            }}
          />
        </>
      )}
    </div>
  );
}

function InterviewRowEl({ row }: { row: InterviewRow }) {
  const status = getStatusStyle(row.status);
  const when = formatDateLine(row.scheduledAt);
  return (
    <tr className="group transition hover:bg-[var(--color-surface-soft)]">
      <td className="px-4 py-3">
        <Link
          href={`/candidate/applications/${row.applicationId}`}
          className="flex min-w-0 items-center gap-3"
        >
          {row.company?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.company.logoUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-[var(--radius-sm)] object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-strong)] text-[var(--color-muted)]"
            >
              <Building2 className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate font-medium text-[var(--color-ink)] group-hover:underline">
              {row.job?.title ?? "Interview"}
            </div>
            <div className="truncate text-xs text-[var(--color-muted)]">
              {row.company?.name ?? "—"}
            </div>
          </div>
        </Link>
      </td>
      <td className="px-4 py-3">
        <div className="text-[var(--color-ink)]">{when.date}</div>
        <div className="font-mono text-xs text-[var(--color-muted)]">{when.time}</div>
      </td>
      <td className="px-4 py-3 text-[var(--color-body)]">
        {formatLabel(row.format)}
      </td>
      <td className="px-4 py-3 text-right font-mono text-[var(--color-body)]">
        {row.durationMinutes} min
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${status.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden />
          {status.label}
        </span>
      </td>
      <td className="px-2 py-3 text-right">
        <Link
          href={`/candidate/applications/${row.applicationId}`}
          aria-label="View application"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-muted)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
}

function EmptyInterviews() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No interviews scheduled
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        When a recruiter schedules an interview, it&apos;ll show up here.
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/candidate/applications"
          className="inline-flex h-11 items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          View applications
        </Link>
        <Link
          href="/candidate/jobs"
          className="inline-flex h-11 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-5 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
        >
          Browse jobs
        </Link>
      </div>
    </div>
  );
}

function EmptyFiltered() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No interviews match your filters
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        Try different search terms or clear the filters.
      </div>
      <Link
        href="/candidate/interviews"
        className="mt-4 inline-flex h-9 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
      >
        Clear filters
      </Link>
    </div>
  );
}
