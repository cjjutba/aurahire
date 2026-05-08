"use client";

import { useState } from "react";
import {
  BarChart3,
  Briefcase,
  ChevronDown,
  Clock,
  Inbox,
  PieChart,
  Plus,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useRecruiterStatsQuery,
  useRecruiterAnalyticsQuery,
  useRecruiterRecentApplicationsQuery,
} from "@/hooks/use-dashboard";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { RealtimeEvent } from "@/lib/realtime";
import type { RecruiterStatsResponse } from "@/lib/query";

type Range = "7d" | "30d" | "90d" | "all";

const RANGE_LABEL: Record<Range, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

export interface KpiData {
  activeJobs: number;
  totalApps: number;
  pendingReview: number;
  avgMatchScore: number;
}

function extractKpis(body: RecruiterStatsResponse): KpiData {
  const data = body.data ?? {};
  return {
    activeJobs: data.activeJobs ?? 0,
    totalApps: data.totalApps ?? data.totalApplications ?? 0,
    pendingReview: data.pendingReview ?? data.pendingReviews ?? 0,
    avgMatchScore: data.avgMatchScore ?? 0,
  };
}

const APP_STATUS: Record<
  string,
  { label: string; dot: string; text: string }
> = {
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
    dot: "bg-[var(--color-status-success)]",
    text: "text-[var(--color-status-success)]",
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

const DEFAULT_APP_STATUS = APP_STATUS[
  "applied"
] as NonNullable<(typeof APP_STATUS)[string]>;

function getAppStatus(s: string): NonNullable<(typeof APP_STATUS)[string]> {
  return APP_STATUS[s] ?? DEFAULT_APP_STATUS;
}

const STATUS_BAR_ORDER = [
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
];

function scoreBandColor(score: number): string {
  if (score === 0) return "text-[var(--color-muted)]";
  if (score < 40) return "text-[var(--color-score-low)]";
  if (score < 70) return "text-[var(--color-score-mid)]";
  return "text-[var(--color-score-high)]";
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

interface RecentApp {
  id: string;
  status: string;
  appliedAt: string;
  candidate: { fullName: string; email: string } | null;
  job: { id: string; title: string } | null;
  matchScore: { band: string; overallScore: number } | null;
}

function ApplicationsByStatusCard({
  data,
}: {
  data: Array<{ status: string; count: number }>;
}) {
  const counts = new Map(data.map((d) => [d.status, d.count]));
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const max = data.reduce((m, d) => Math.max(m, d.count), 0);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <div className="mb-4 flex items-center gap-2">
        <PieChart className="h-3.5 w-3.5 text-[var(--color-muted)]" aria-hidden />
        <h2 className="text-base font-semibold text-[var(--color-ink)]">
          Applications by Status
        </h2>
      </div>
      {total === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--color-muted)]">
          No applications yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {STATUS_BAR_ORDER.map((status) => {
            const count = counts.get(status) ?? 0;
            const meta = getAppStatus(status);
            const widthPct =
              max === 0 ? 0 : Math.max(2, Math.round((count / max) * 100));
            return (
              <li key={status} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs font-medium text-[var(--color-ink)]">
                  {meta.label}
                </span>
                <div className="flex-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-soft)]">
                  <div
                    className={`h-2 rounded-[var(--radius-sm)] ${meta.dot}`}
                    style={{ width: count === 0 ? "0%" : `${widthPct}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right font-mono text-xs text-[var(--color-ink)]">
                  {count}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TopJobsByVolumeCard({
  data,
}: {
  data: Array<{ jobId: string; title: string; applicationCount: number }>;
}) {
  const top = data.slice(0, 5);
  const max = top.reduce((m, j) => Math.max(m, j.applicationCount), 0);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-3.5 w-3.5 text-[var(--color-muted)]" aria-hidden />
        <h2 className="text-base font-semibold text-[var(--color-ink)]">
          Top Jobs by Volume
        </h2>
      </div>
      {top.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--color-muted)]">
          No active jobs yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {top.map((job) => {
            const widthPct =
              max === 0
                ? 0
                : Math.max(2, Math.round((job.applicationCount / max) * 100));
            return (
              <li key={job.jobId}>
                <a
                  href={`/recruiter/jobs/${job.jobId}`}
                  className="flex items-center gap-3 transition hover:opacity-80"
                >
                  <div className="relative min-w-0 flex-1">
                    <div
                      className="absolute inset-y-0 left-0 rounded-[var(--radius-sm)] bg-[var(--color-primary-soft)]"
                      style={{ width: `${widthPct}%` }}
                      aria-hidden
                    />
                    <span className="relative truncate px-2 py-1 text-sm font-medium text-[var(--color-ink)]">
                      {job.title}
                    </span>
                  </div>
                  <span className="w-8 shrink-0 text-right font-mono text-xs text-[var(--color-ink)]">
                    {job.applicationCount}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RecentAppRow({ app }: { app: RecentApp }) {
  const status = getAppStatus(app.status);
  return (
    <li>
      <a
        href={`/recruiter/applications/${app.id}`}
        className="flex items-center gap-4 px-4 py-3 transition hover:bg-[var(--color-surface-soft)]"
      >
        <span
          className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${status.text}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
            aria-hidden
          />
          {status.label}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-xs font-semibold text-[var(--color-ink)]">
          {getInitials(app.candidate?.fullName ?? "?")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-[var(--color-ink)]">
            {app.candidate?.fullName ?? "(unknown candidate)"}
          </div>
          <div className="truncate text-xs text-[var(--color-muted)]">
            Applied to{" "}
            <strong className="font-semibold">{app.job?.title ?? "(job)"}</strong>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {app.matchScore && (
            <span className="font-mono text-xs">
              <span className={scoreBandColor(app.matchScore.overallScore)}>
                {app.matchScore.overallScore}
              </span>
              <span className="text-[var(--color-muted)]">/100</span>
            </span>
          )}
          <time className="text-xs text-[var(--color-muted)]">
            {new Date(app.appliedAt).toLocaleDateString()}
          </time>
        </div>
      </a>
    </li>
  );
}

function EmptyAppsState({ hasJobs }: { hasJobs: boolean }) {
  return (
    <div className="px-4 py-12 text-center">
      <Inbox className="mx-auto h-6 w-6 text-[var(--color-muted)]" aria-hidden />
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No applications yet
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        {hasJobs
          ? "Once candidates apply to your jobs, they'll appear here."
          : "Post a job to start collecting applications."}
      </div>
      {!hasJobs && (
        <Link
          href="/recruiter/jobs/new"
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
        >
          <Plus className="h-3.5 w-3.5" />
          Post your first job
        </Link>
      )}
    </div>
  );
}

function FirstRunWelcomeCard({ recruiterName }: { recruiterName?: string | null }) {
  const greeting = recruiterName ? `Welcome, ${recruiterName.split(" ")[0]}.` : "Welcome to AuraHire.";
  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-gradient-to-br from-[var(--color-primary-soft)]/40 to-[var(--color-canvas)] p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
            {greeting}
          </h2>
          <p className="mt-2 max-w-[640px] text-sm text-[var(--color-body)]">
            You&apos;re all set. Post your first job to start matching with qualified candidates — AuraHire will score every application against your criteria and explain how each candidate matched.
          </p>
        </div>
        <Link
          href="/recruiter/jobs/new"
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 text-base font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
        >
          <Plus className="h-4 w-4" />
          Post your first job
        </Link>
      </div>
    </section>
  );
}

function KpiTile({
  label,
  value,
  icon: Icon,
  description,
  tone = "neutral",
  loading = false,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  tone?: "neutral" | "warn" | "score";
  loading?: boolean;
}) {
  let valueClass = "text-[var(--color-ink)]";
  if (tone === "score") {
    if (value === 0) valueClass = "text-[var(--color-muted)]";
    else if (value < 40) valueClass = "text-[var(--color-score-low)]";
    else if (value < 70) valueClass = "text-[var(--color-score-mid)]";
    else valueClass = "text-[var(--color-score-high)]";
  } else if (tone === "warn") {
    valueClass = "text-[var(--color-status-warning)]";
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </span>
        <Icon className="h-4 w-4 text-[var(--color-muted)]" aria-hidden />
      </div>
      <div className={`mt-3 font-mono text-3xl font-medium ${loading ? "text-[var(--color-muted)]" : valueClass}`}>
        {loading ? "—" : value}
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">{description}</div>
    </div>
  );
}

export function RecruiterDashboardClient({
  defaultRange,
  recentLimit,
}: {
  defaultRange: Range;
  recentLimit: number;
}) {
  const [range, setRange] = useState<Range>(defaultRange);
  const queryClient = useQueryClient();

  // Targeted invalidation: only stats + recent depend on application events.
  // Analytics aggregations (heavier query) only need a refetch on the natural
  // refetchInterval, not on every incoming event.
  const invalidateDashboard = (): void => {
    void queryClient.invalidateQueries({
      queryKey: ["recruiter-dashboard", "stats"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["recruiter-dashboard", "recent"],
    });
  };

  useRealtimeChannel(RealtimeEvent.ApplicationCreated, invalidateDashboard);
  useRealtimeChannel(RealtimeEvent.ApplicationStatusChanged, invalidateDashboard);

  const stats = useRecruiterStatsQuery(range);
  const analytics = useRecruiterAnalyticsQuery();
  const recent = useRecruiterRecentApplicationsQuery(recentLimit);

  const kpis: KpiData =
    stats.data != null
      ? extractKpis(stats.data)
      : { activeJobs: 0, totalApps: 0, pendingReview: 0, avgMatchScore: 0 };

  const analyticsData = analytics.data?.data ?? {
    kpis: { activeJobs: 0, totalApplications: 0, pendingReviews: 0, avgMatchScore: 0 },
    topJobs: [],
    applicationsByStatus: [],
  };

  const recentApps: RecentApp[] = recent.data?.data ?? [];

  // First-run state: stats loaded and the recruiter has zero jobs AND zero apps.
  // Skip the welcome card during initial fetch so we don't flash it briefly.
  const isFirstRun =
    !stats.isLoading &&
    !analytics.isLoading &&
    kpis.activeJobs === 0 &&
    kpis.totalApps === 0;

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <header>
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          Recruiter Dashboard
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          Pipeline at a glance.
        </p>
      </header>

      {isFirstRun && <FirstRunWelcomeCard />}

      {/* Section 1: KPI Hero Row with date filter */}
      <section>
        <div className="mb-3 flex items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-3 text-sm font-medium text-[var(--color-ink)] disabled:opacity-60"
                  disabled={stats.isFetching}
                />
              }
            >
              <span>{RANGE_LABEL[range]}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
                <DropdownMenuItem key={r} onClick={() => setRange(r)}>
                  {RANGE_LABEL[r]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            label="Active Jobs"
            value={kpis.activeJobs}
            icon={Briefcase}
            description="Currently published"
            loading={stats.isLoading}
          />
          <KpiTile
            label="Total Applications"
            value={kpis.totalApps}
            icon={Inbox}
            description={RANGE_LABEL[range]}
            loading={stats.isLoading}
          />
          <KpiTile
            label="Pending Review"
            value={kpis.pendingReview}
            icon={Clock}
            description="Need attention"
            tone={kpis.pendingReview > 0 ? "warn" : "neutral"}
            loading={stats.isLoading}
          />
          <KpiTile
            label="Avg Match Score"
            value={kpis.avgMatchScore}
            icon={Sparkles}
            description="Across all apps"
            tone="score"
            loading={stats.isLoading}
          />
        </div>
      </section>

      {/* Section 2: Pipeline Snapshot */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5 text-[var(--color-muted)]" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Pipeline Snapshot
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ApplicationsByStatusCard data={analyticsData.applicationsByStatus} />
          <TopJobsByVolumeCard data={analyticsData.topJobs} />
        </div>
      </section>

      {/* Section 3: Recent Applications */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className="h-3.5 w-3.5 text-[var(--color-muted)]" aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Recent Applications
            </span>
          </div>
          <a
            href="/recruiter/applications"
            className="text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            View all →
          </a>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
          {recentApps.length === 0 ? (
            <EmptyAppsState hasJobs={kpis.activeJobs > 0} />
          ) : (
            <ul className="divide-y divide-[var(--color-hairline-soft)]">
              {recentApps.map((app) => (
                <RecentAppRow key={app.id} app={app} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
