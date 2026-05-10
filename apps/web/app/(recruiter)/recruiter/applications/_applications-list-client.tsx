"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Building2, User2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { MatchBandChip } from "@/components/score/match-band-chip";
import { ClickableRow } from "@/components/ui/clickable-row";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecruiterApplicationsListQuery } from "@/hooks/use-applications";
import { RealtimeEvent } from "@/lib/realtime";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";

import { ApplicationsToolbarClient } from "./_applications-toolbar-client";
import { ApplicationsPagination } from "./_applications-pagination";
import { RecruiterApplicationRowActionsClient } from "./_row-actions-client";

interface AppRow {
  id: string;
  status: string;
  appliedAt: string;
  candidate: {
    id: string;
    fullName: string;
    email: string;
    headline: string | null;
  } | null;
  job: {
    id: string;
    title: string;
    company: { name: string; logoUrl: string | null };
  } | null;
  matchScore: {
    band: "strong" | "partial" | "limited";
    overallScore: number;
  } | null;
}

const APP_STATUS: Record<string, { label: string; dot: string; text: string }> =
  {
    applied: {
      label: "Applied",
      dot: "bg-[var(--color-status-info)]",
      text: "text-[var(--color-status-info)]",
    },
    screening: {
      label: "Screening",
      dot: "bg-[var(--color-status-info)]",
      text: "text-[var(--color-status-info)]",
    },
    interview: {
      label: "Interview",
      dot: "bg-[var(--color-status-info)]",
      text: "text-[var(--color-status-info)]",
    },
    offer: {
      label: "Offer",
      dot: "bg-[var(--color-status-warning)]",
      text: "text-[var(--color-status-warning)]",
    },
    hired: {
      label: "Hired",
      dot: "bg-[var(--color-status-success)]",
      text: "text-[var(--color-status-success)]",
    },
    rejected: {
      label: "Rejected",
      dot: "bg-[var(--color-status-danger)]",
      text: "text-[var(--color-status-danger)]",
    },
    withdrawn: {
      label: "Withdrawn",
      dot: "bg-[var(--color-muted)]",
      text: "text-[var(--color-muted)]",
    },
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

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
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

export function ApplicationsListClient({
  params,
}: ApplicationsListClientProps) {
  const queryClient = useQueryClient();
  const { data, isError, isLoading } =
    useRecruiterApplicationsListQuery(params);

  const invalidateList = (): void => {
    queryClient.invalidateQueries({
      queryKey: ["recruiter-applications", "list"],
    });
  };

  useRealtimeChannel(RealtimeEvent.ApplicationCreated, invalidateList);
  useRealtimeChannel(RealtimeEvent.ApplicationStatusChanged, invalidateList);

  const rows = useMemo(() => (data?.data ?? []) as AppRow[], [data?.data]);
  const meta = data?.meta ?? {
    page: params.page,
    limit: params.limit,
    total: 0,
    totalPages: 1,
  };

  const filtersActive = !!(params.q || params.status || params.band);

  if (isError) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <p className="text-sm text-[var(--color-status-danger)]">
          Failed to load applications. Please refresh the page.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <header>
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          Applications
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          {isLoading
            ? "Loading…"
            : meta.total === 0
              ? "No applications yet"
              : `${meta.total} application${meta.total === 1 ? "" : "s"} across your company's jobs`}
        </p>
      </header>

      <ApplicationsToolbarClient
        initialQuery={params.q ?? ""}
        status={params.status ?? "all"}
        band={params.band ?? "all"}
        sort={params.sort}
      />

      {isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        filtersActive ? (
          <EmptyFiltered />
        ) : (
          <EmptyApplications />
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Candidate
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Job
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
            meta={meta}
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
  const score = app.matchScore;
  const candidateName = app.candidate?.fullName ?? "Unknown candidate";
  const initials = getInitials(candidateName);
  return (
    <ClickableRow
      href={`/recruiter/applications/${app.id}`}
      ariaLabel={`Open application from ${candidateName}`}
    >
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-surface-strong)] text-[11px] font-semibold uppercase text-[var(--color-ink)]"
          >
            {initials !== "?" ? (
              initials
            ) : (
              <User2 className="h-4 w-4 text-[var(--color-muted)]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium text-[var(--color-ink)]">
              {candidateName}
            </div>
            <div className="truncate text-xs text-[var(--color-muted)]">
              {app.candidate?.headline ?? app.candidate?.email ?? ""}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {app.job?.company?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={app.job.company.logoUrl}
              alt=""
              className="h-7 w-7 shrink-0 rounded-[var(--radius-sm)] object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-strong)] text-[var(--color-muted)]"
            >
              <Building2 className="h-3.5 w-3.5" />
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm text-[var(--color-ink)]">
              {app.job?.title ?? "—"}
            </div>
          </div>
        </div>
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
      <td className="px-4 py-3">
        {score ? (
          <MatchBandChip band={score.band} />
        ) : (
          <span className="text-xs text-[var(--color-muted)]">Pending</span>
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono text-[var(--color-ink)]">
        {score ? (
          <>
            {score.overallScore}
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
        <RecruiterApplicationRowActionsClient
          applicationId={app.id}
          status={app.status}
          candidateName={candidateName}
        />
      </td>
    </ClickableRow>
  );
}

function LoadingState() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
      <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_0.8fr_1fr_40px] gap-4 border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-4 py-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="ml-auto h-3 w-12" />
        <Skeleton className="h-3 w-14" />
        <span />
      </div>
      <div className="divide-y divide-[var(--color-hairline-soft)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[2fr_1.5fr_1fr_1fr_0.8fr_1fr_40px] items-center gap-4 px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-[var(--radius-full)]" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <Skeleton className="h-7 w-7 shrink-0 rounded-[var(--radius-sm)]" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-5 w-20 rounded-[var(--radius-pill)]" />
            <Skeleton className="h-5 w-24 rounded-[var(--radius-pill)]" />
            <Skeleton className="ml-auto h-4 w-12" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ml-auto h-6 w-6 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyApplications() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No applications yet
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        Once candidates apply to your published jobs, they&apos;ll appear here.
      </div>
      <Link
        href="/recruiter/jobs"
        className="mt-4 inline-flex h-11 items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
      >
        Manage jobs
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
        href="/recruiter/applications"
        className="mt-4 inline-flex h-9 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
      >
        Clear filters
      </Link>
    </div>
  );
}
