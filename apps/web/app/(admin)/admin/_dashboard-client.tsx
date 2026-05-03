"use client";

import { useEffect, useState } from "react";
import {
  getAccessToken,
  useAdminStatsControllerOverviewV1,
  type AdminStatsOverviewDto,
  type AdminStatsOverviewEnvelopeDto,
} from "@aurahire/shared";
import { Skeleton } from "@/components/ui/skeleton";

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

export function DashboardClient() {
  const tokenReady = useAuthTokenReady();
  const { data, isPending, isError } = useAdminStatsControllerOverviewV1({
    query: {
      staleTime: 60_000,
      enabled: tokenReady,
    },
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
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[
          { key: "totalUsers", label: "Total Users" },
          { key: "activeJobs", label: "Active Jobs" },
          { key: "applicationsToday", label: "Apps Today" },
          { key: "applicationsThisWeek", label: "Apps This Week" },
          { key: "avgProfileScore", label: "Avg Profile Score" },
          { key: "avgMatchScore", label: "Avg Match Score" },
        ].map((card) => {
          const block = stats?.[card.key as keyof typeof stats] as
            | { label: string; value: number }
            | undefined;
          return (
            <div
              key={card.key}
              className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {block?.label ?? card.label}
              </h3>
              {isPending || !block ? (
                <Skeleton className="mt-3 h-9 w-16" />
              ) : (
                <p className="mt-3 font-mono text-3xl font-medium text-[var(--color-ink)]">
                  {block.value}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ScoreDistributionWidget stats={stats} isPending={isPending} />
        <BiasFlagsWidget stats={stats} isPending={isPending} />
        <RecentAuditWidget stats={stats} isPending={isPending} />
      </div>
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
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        Score Distribution (Last 30 Days)
      </h3>
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

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        Bias Flags This Week
      </h3>
      {isPending ? (
        <div className="mt-6 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
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
            <ul className="mt-6 space-y-2">
              {flags.map((entry) => (
                <li
                  key={entry.category}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="capitalize text-[var(--color-body)]">
                    {entry.category}
                  </span>
                  <span className="font-mono text-[var(--color-ink)]">
                    {entry.count}
                  </span>
                </li>
              ))}
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
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        Recent Audit Events
      </h3>
      {isPending ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--color-body)]">
          No recent activity.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {events.map((e, i) => (
            <li key={i} className="text-xs">
              <code className="rounded-[var(--radius-xs)] bg-[var(--color-surface-soft)] px-1 py-0.5 font-mono text-[var(--color-ink)]">
                {e.action}
              </code>
              <span className="ml-2 text-[var(--color-muted)]">
                {e.actorType} · {new Date(e.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
