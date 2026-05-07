"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Building2, ChevronRight, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { MatchBandChip } from "@/components/score/match-band-chip";
import { useMyApplicationsQuery } from "@/hooks/use-applications";
import { RealtimeEvent } from "@/lib/realtime";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";

import { ApplicationsToolbarClient } from "./_applications-toolbar-client";
import { ApplicationsPagination } from "./_applications-pagination";

interface AppRow {
  id: string;
  status: string;
  appliedAt: string;
  job: {
    title: string;
    company: { name: string; logoUrl: string | null };
  } | null;
  matchScore: { band: "strong" | "partial" | "limited"; overallScore: number } | null;
}

const APP_STATUS: Record<string, { label: string; dot: string; text: string }> = {
  applied:    { label: "Applied",    dot: "bg-[var(--color-status-info)]",    text: "text-[var(--color-status-info)]" },
  screening:  { label: "Screening",  dot: "bg-[var(--color-status-info)]",    text: "text-[var(--color-status-info)]" },
  interview:  { label: "Interview",  dot: "bg-[var(--color-status-info)]",    text: "text-[var(--color-status-info)]" },
  offer:      { label: "Offer",      dot: "bg-[var(--color-status-warning)]", text: "text-[var(--color-status-warning)]" },
  hired:      { label: "Hired",      dot: "bg-[var(--color-status-success)]", text: "text-[var(--color-status-success)]" },
  rejected:   { label: "Rejected",   dot: "bg-[var(--color-status-danger)]",  text: "text-[var(--color-status-danger)]" },
  withdrawn:  { label: "Withdrawn",  dot: "bg-[var(--color-muted)]",          text: "text-[var(--color-muted)]" },
};

const DEFAULT_APP_STATUS = APP_STATUS["applied"]!;

function getAppStatus(s: string) {
  return APP_STATUS[s] ?? DEFAULT_APP_STATUS;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface ApplicationsListClientProps {
  params: {
    q?: string;
    status?: string;
    band?: string;
    sort: string;
    page: number;
    limit: number;
  };
}

export function ApplicationsListClient({ params }: ApplicationsListClientProps) {
  const queryClient = useQueryClient();
  const { data, isError } = useMyApplicationsQuery({});

  const invalidateList = (): void => {
    queryClient.invalidateQueries({ queryKey: ["candidate-applications"] });
  };

  useRealtimeChannel(RealtimeEvent.ApplicationStatusChanged, invalidateList);
  useRealtimeChannel(RealtimeEvent.OfferSent, invalidateList);

  const all = useMemo(
    () => (data?.data ?? []) as AppRow[],
    [data?.data],
  );

  const filtered = useMemo(() => {
    let rows = [...all];

    if (params.q) {
      const needle = params.q.toLowerCase();
      rows = rows.filter((r) => {
        const title = r.job?.title?.toLowerCase() ?? "";
        const company = r.job?.company?.name?.toLowerCase() ?? "";
        return title.includes(needle) || company.includes(needle);
      });
    }
    if (params.status) {
      rows = rows.filter((r) => r.status === params.status);
    }
    if (params.band) {
      if (params.band === "pending") {
        rows = rows.filter((r) => r.matchScore == null);
      } else {
        rows = rows.filter((r) => r.matchScore?.band === params.band);
      }
    }

    rows.sort((a, b) => {
      switch (params.sort) {
        case "oldest":
          return new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime();
        case "score-high": {
          const sa = a.matchScore?.overallScore ?? -1;
          const sb = b.matchScore?.overallScore ?? -1;
          if (sb !== sa) return sb - sa;
          return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
        }
        case "recent":
        default:
          return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
      }
    });

    return rows;
  }, [all, params.q, params.status, params.band, params.sort]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  const safePage = Math.min(params.page, totalPages);
  const startIdx = (safePage - 1) * params.limit;
  const rows = filtered.slice(startIdx, startIdx + params.limit);

  if (isError) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <p className="text-sm text-[var(--color-status-danger)]">
          Failed to load applications. Please refresh the page.
        </p>
      </div>
    );
  }

  const filtersActive = !!(params.q || params.status || params.band);

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
            My Applications
          </h1>
          <p className="mt-2 text-sm text-[var(--color-body)]">
            {all.length === 0
              ? "No applications yet"
              : `${all.length} application${all.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link
          href="/candidate/jobs"
          className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          <Search className="h-4 w-4" />
          Browse Jobs
        </Link>
      </header>

      {/* Toolbar */}
      <ApplicationsToolbarClient
        initialQuery={params.q ?? ""}
        status={params.status ?? "all"}
        band={params.band ?? "all"}
        sort={params.sort}
      />

      {/* Table or empty state */}
      {rows.length === 0 ? (
        filtersActive ? <EmptyFiltered /> : <EmptyApplications />
      ) : (
        <>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Application
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Match
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Score
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Applied
                  </th>
                  <th className="w-10 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline-soft)]">
                {rows.map((app) => (
                  <ApplicationRow key={app.id} app={app} />
                ))}
              </tbody>
            </table>
          </div>
          <ApplicationsPagination
            meta={{
              page: safePage,
              limit: params.limit,
              total,
              totalPages,
            }}
            searchParams={{
              q: params.q,
              status: params.status,
              band: params.band,
              sort: params.sort,
            }}
          />
        </>
      )}
    </div>
  );
}

function ApplicationRow({ app }: { app: AppRow }) {
  const status = getAppStatus(app.status);
  const company = app.job?.company;
  return (
    <tr className="group transition hover:bg-[var(--color-surface-soft)]">
      <td className="px-4 py-3">
        <Link
          href={`/candidate/applications/${app.id}`}
          className="flex min-w-0 items-center gap-3"
        >
          {company?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
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
              {app.job?.title ?? "Job"}
            </div>
            <div className="truncate text-xs text-[var(--color-muted)]">
              {company?.name ?? "—"}
            </div>
          </div>
        </Link>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${status.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden />
          {status.label}
        </span>
      </td>
      <td className="px-4 py-3">
        {app.matchScore ? (
          <MatchBandChip band={app.matchScore.band} />
        ) : (
          <span className="text-xs text-[var(--color-muted)]">Pending</span>
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono text-[var(--color-ink)]">
        {app.matchScore ? (
          <>
            {app.matchScore.overallScore}
            <span className="text-[var(--color-muted)]">/100</span>
          </>
        ) : (
          <span className="text-[var(--color-muted)]">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-[var(--color-muted)]">
        {formatDate(app.appliedAt)}
      </td>
      <td className="px-2 py-3 text-right">
        <Link
          href={`/candidate/applications/${app.id}`}
          aria-label="View application"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-muted)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
}

function EmptyApplications() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No applications yet
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        Browse open roles and apply to start your pipeline.
      </div>
      <Link
        href="/candidate/jobs"
        className="mt-4 inline-flex h-11 items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
      >
        Browse Jobs
      </Link>
    </div>
  );
}

function EmptyFiltered() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No applications match your filters
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        Try different search terms or clear the filters.
      </div>
      <Link
        href="/candidate/applications"
        className="mt-4 inline-flex h-9 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
      >
        Clear filters
      </Link>
    </div>
  );
}
