"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Briefcase,
  Cpu,
  Inbox,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  getAccessToken,
  useAdminStatsControllerOverviewV1,
  type AdminStatsOverviewDto,
  type AdminStatsOverviewEnvelopeDto,
} from "@aurahire/shared";

import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { RealtimeEvent } from "@/lib/realtime";
import { humanizeAuditAction } from "@/lib/audit/humanize-action";

type Stats = AdminStatsOverviewDto;

/**
 * Defer the React Query call until AuthTokenProvider has populated the module-
 * level access token. Without this gate, the first fetch can race ahead of the
 * Supabase session read and 401 on cold loads.
 */
function useAuthTokenReady(): boolean {
  const [ready, setReady] = useState(() => getAccessToken() !== null);
  useEffect(() => {
    if (ready) return;
    const interval = window.setInterval(() => {
      if (getAccessToken() !== null) {
        setReady(true);
        window.clearInterval(interval);
      }
    }, 50);
    return () => window.clearInterval(interval);
  }, [ready]);
  return ready;
}

const BAND_COLOR: Record<string, string> = {
  strong: "var(--color-score-high)",
  partial: "var(--color-score-mid)",
  limited: "var(--color-score-low)",
};

const ACTOR_BG: Record<string, string> = {
  user: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
  ai: "bg-[var(--color-score-mid-soft)] text-[var(--color-score-mid)]",
  system: "bg-[var(--color-surface-strong)] text-[var(--color-muted)]",
};

const ACTOR_ICON: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  user: Users,
  ai: Sparkles,
  system: Cpu,
};

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return new Date(iso).toLocaleString();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function SectionHeader({
  icon: Icon,
  label,
  trailing,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[var(--color-muted)]" aria-hidden />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </span>
      </div>
      {trailing}
    </div>
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
  tone?: "neutral" | "score";
  loading?: boolean;
}) {
  let valueClass = "text-[var(--color-ink)]";
  if (tone === "score") {
    if (value === 0) valueClass = "text-[var(--color-muted)]";
    else if (value < 40) valueClass = "text-[var(--color-score-low)]";
    else if (value < 70) valueClass = "text-[var(--color-score-mid)]";
    else valueClass = "text-[var(--color-score-high)]";
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </span>
        <Icon className="h-4 w-4 text-[var(--color-muted)]" aria-hidden />
      </div>
      <div
        className={`mt-3 font-mono text-3xl font-medium ${
          loading ? "text-[var(--color-muted)]" : valueClass
        }`}
      >
        {loading ? "—" : value}
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        {description}
      </div>
    </div>
  );
}

const FOOTPRINT_TILES: Array<{
  key: keyof Stats;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "neutral" | "score";
}> = [
  {
    key: "totalUsers",
    label: "Total Users",
    description: "All-time accounts",
    icon: Users,
    tone: "neutral",
  },
  {
    key: "activeJobs",
    label: "Active Jobs",
    description: "Currently published",
    icon: Briefcase,
    tone: "neutral",
  },
  {
    key: "applicationsThisWeek",
    label: "Apps This Week",
    description: "Submitted in last 7 days",
    icon: TrendingUp,
    tone: "neutral",
  },
];

const QUALITY_TILES: Array<{
  key: keyof Stats;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "neutral" | "score";
}> = [
  {
    key: "applicationsToday",
    label: "Apps Today",
    description: "Submitted today",
    icon: Inbox,
    tone: "neutral",
  },
  {
    key: "avgProfileScore",
    label: "Avg Profile Score",
    description: "Across all candidates",
    icon: Sparkles,
    tone: "score",
  },
  {
    key: "avgMatchScore",
    label: "Avg Match Score",
    description: "Last 30 days",
    icon: BarChart3,
    tone: "score",
  },
];

export function DashboardClient() {
  const tokenReady = useAuthTokenReady();
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useAdminStatsControllerOverviewV1({
    query: {
      staleTime: 60_000,
      enabled: tokenReady,
    },
  });

  useRealtimeChannel(RealtimeEvent.AuditEntry, () => {
    queryClient.invalidateQueries({
      queryKey: ["/api/v1/admin/stats/overview"],
    });
  });

  useRealtimeChannel(RealtimeEvent.BiasFlagCreated, () => {
    queryClient.invalidateQueries({
      queryKey: ["/api/v1/admin/stats/overview"],
    });
  });

  if (isError) {
    return (
      <div className="text-[var(--color-status-danger)]">
        Failed to load admin overview.
      </div>
    );
  }

  // Custom fetcher returns the unwrapped JSON body, but orval types it as a
  // {data, status, headers} response wrapper. The runtime body is the envelope.
  const envelope = data as unknown as AdminStatsOverviewEnvelopeDto | undefined;
  const stats = envelope?.data;

  return (
    <div className="space-y-8">
      <section>
        <SectionHeader icon={BarChart3} label="Footprint" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FOOTPRINT_TILES.map((tile) => {
            const block = stats?.[tile.key] as
              | { label: string; value: number }
              | undefined;
            return (
              <KpiTile
                key={tile.key as string}
                label={block?.label ?? tile.label}
                value={block?.value ?? 0}
                icon={tile.icon}
                description={tile.description}
                tone={tile.tone}
                loading={isPending || !block}
              />
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeader icon={Sparkles} label="Today & AI Quality" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {QUALITY_TILES.map((tile) => {
            const block = stats?.[tile.key] as
              | { label: string; value: number }
              | undefined;
            return (
              <KpiTile
                key={tile.key as string}
                label={block?.label ?? tile.label}
                value={block?.value ?? 0}
                icon={tile.icon}
                description={tile.description}
                tone={tile.tone}
                loading={isPending || !block}
              />
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeader icon={Activity} label="Snapshot" />
        <div className="grid gap-4 lg:grid-cols-3">
          <ScoreDistributionWidget stats={stats} isPending={isPending} />
          <BiasFlagsWidget stats={stats} isPending={isPending} />
          <RecentAuditWidget stats={stats} isPending={isPending} />
        </div>
      </section>
    </div>
  );
}

function ScoreDistributionWidget({
  stats,
  isPending,
}: {
  stats: Stats | undefined;
  isPending: boolean;
}) {
  const histogram = stats?.scoreBandHistogram ?? [];
  const totalScores = histogram.reduce((sum, e) => sum + e.count, 0);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <div className="flex items-center gap-2">
        <BarChart3
          className="h-3.5 w-3.5 text-[var(--color-muted)]"
          aria-hidden
        />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Score Distribution (Last 30 Days)
        </h3>
      </div>
      {isPending ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      ) : (
        <>
          <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">
            {totalScores} total
          </p>
          {totalScores === 0 ? (
            <p className="mt-6 text-sm text-[var(--color-body)]">
              No match scores yet.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {histogram.map((entry) => {
                const pct = Math.round((entry.count / totalScores) * 100);
                return (
                  <div key={entry.band}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-[var(--color-body)]">
                        {entry.band}
                      </span>
                      <span className="font-mono text-[var(--color-muted)]">
                        {entry.count} · {pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)]">
                      <div
                        className="h-2 rounded-[var(--radius-pill)]"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: BAND_COLOR[entry.band],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BiasFlagsWidget({
  stats,
  isPending,
}: {
  stats: Stats | undefined;
  isPending: boolean;
}) {
  const flags = stats?.biasFlagsThisWeek ?? [];
  const totalFlags = flags.reduce((sum, e) => sum + e.count, 0);
  const max = Math.max(0, ...flags.map((f) => f.count));

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <div className="flex items-center gap-2">
        <AlertTriangle
          className="h-3.5 w-3.5 text-[var(--color-muted)]"
          aria-hidden
        />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Bias Flags This Week
        </h3>
      </div>
      {isPending ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      ) : (
        <>
          <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">
            {totalFlags} total
          </p>
          {totalFlags === 0 ? (
            <p className="mt-6 text-sm text-[var(--color-body)]">
              No flags this week.
            </p>
          ) : (
            <ul className="mt-6 space-y-3">
              {flags.map((entry) => {
                const widthPct =
                  max === 0
                    ? 0
                    : Math.max(2, Math.round((entry.count / max) * 100));
                return (
                  <li key={entry.category}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-[var(--color-body)]">
                        {entry.category}
                      </span>
                      <span className="font-mono text-[var(--color-ink)]">
                        {entry.count}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)]">
                      <div
                        className="h-2 rounded-[var(--radius-pill)]"
                        style={{
                          width: entry.count === 0 ? "0%" : `${widthPct}%`,
                          backgroundColor: "var(--color-status-warning)",
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function RecentAuditWidget({
  stats,
  isPending,
}: {
  stats: Stats | undefined;
  isPending: boolean;
}) {
  const events = stats?.recentAuditEvents ?? [];

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity
            className="h-3.5 w-3.5 text-[var(--color-muted)]"
            aria-hidden
          />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Recent Audit Events
          </h3>
        </div>
        <Link
          href="/admin/audit"
          className="text-xs font-medium text-[var(--color-primary)] hover:underline"
        >
          View all →
        </Link>
      </div>
      {isPending ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--color-body)]">
          No recent activity.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--color-hairline-soft)]">
          {events.map((e, i) => {
            const Icon = ACTOR_ICON[e.actorType] ?? Activity;
            const actorClass =
              ACTOR_BG[e.actorType] ??
              "bg-[var(--color-surface-strong)] text-[var(--color-muted)]";
            const label = humanizeAuditAction(e.action);
            return (
              <li
                key={i}
                className="flex items-center gap-3 py-2.5"
                title={e.action}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-full)] ${actorClass}`}
                  aria-hidden
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[var(--color-ink)]">
                    {label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
                    {relativeTime(e.createdAt)}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 rounded-[var(--radius-pill)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${actorClass}`}
                >
                  {e.actorType}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
