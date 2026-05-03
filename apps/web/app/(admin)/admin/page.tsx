import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";

export const metadata = { title: "Command Center" };

interface OverviewBody {
  data: {
    totalUsers: { label: string; value: number; trend: string | null };
    activeJobs: { label: string; value: number; trend: string | null };
    applicationsToday: { label: string; value: number; trend: string | null };
    applicationsThisWeek: { label: string; value: number; trend: string | null };
    avgProfileScore: { label: string; value: number; trend: string | null };
    avgMatchScore: { label: string; value: number; trend: string | null };
    scoreBandHistogram: Array<{ band: "strong" | "partial" | "limited"; count: number }>;
    biasFlagsThisWeek: Array<{ category: string; count: number }>;
    recentAuditEvents: Array<{
      action: string;
      actorType: string;
      entityType: string;
      createdAt: string;
    }>;
  };
}

const BAND_COLOR: Record<string, string> = {
  strong: "var(--color-score-high)",
  partial: "var(--color-score-mid)",
  limited: "var(--color-score-low)",
};

export default async function AdminDashboard() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/admin/stats/overview`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="text-[var(--color-status-danger)]">
        Failed to load admin overview ({res.status}).
      </div>
    );
  }

  const body = (await res.json()) as OverviewBody;
  const stats = body.data;
  const totalScores = stats.scoreBandHistogram.reduce((sum, e) => sum + e.count, 0);
  const totalBiasFlags = stats.biasFlagsThisWeek.reduce((sum, e) => sum + e.count, 0);

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Command Center
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          System health at a glance.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[
          stats.totalUsers,
          stats.activeJobs,
          stats.applicationsToday,
          stats.applicationsThisWeek,
          stats.avgProfileScore,
          stats.avgMatchScore,
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5"
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              {s.label}
            </h3>
            <p className="mt-3 font-mono text-3xl font-medium text-[var(--color-ink)]">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Score Distribution (Last 30 Days)
          </h3>
          <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">
            {totalScores} total
          </p>
          {totalScores === 0 ? (
            <p className="mt-6 text-sm text-[var(--color-body)]">No match scores yet.</p>
          ) : (
            <div className="mt-6 space-y-3">
              {stats.scoreBandHistogram.map((entry) => {
                const pct = Math.round((entry.count / totalScores) * 100);
                return (
                  <div key={entry.band}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-[var(--color-body)]">{entry.band}</span>
                      <span className="font-mono text-[var(--color-muted)]">
                        {entry.count} · {pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)]">
                      <div
                        className="h-2 rounded-[var(--radius-pill)]"
                        style={{ width: `${pct}%`, backgroundColor: BAND_COLOR[entry.band] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Bias Flags This Week
          </h3>
          <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">
            {totalBiasFlags} total
          </p>
          {totalBiasFlags === 0 ? (
            <p className="mt-6 text-sm text-[var(--color-body)]">No flags this week.</p>
          ) : (
            <ul className="mt-6 space-y-2">
              {stats.biasFlagsThisWeek.map((entry) => (
                <li key={entry.category} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-[var(--color-body)]">{entry.category}</span>
                  <span className="font-mono text-[var(--color-ink)]">{entry.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Recent Audit Events
          </h3>
          {stats.recentAuditEvents.length === 0 ? (
            <p className="mt-6 text-sm text-[var(--color-body)]">No recent activity.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {stats.recentAuditEvents.map((e, i) => (
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
      </div>
    </div>
  );
}
