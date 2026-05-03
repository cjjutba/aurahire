interface Props {
  kpis: {
    totalUsers: number;
    newUsersThisPeriod: number;
    growthPct: number;
    activeJobs: number;
    avgApplicationsPerDay: number;
    avgTimeToHireDays: number | null;
  };
}

export function KpiTiles({ kpis }: Props) {
  const tiles: Array<{
    label: string;
    value: number | string;
    sub: string | null;
  }> = [
    {
      label: "Total Users",
      value: kpis.totalUsers,
      sub: `+${kpis.newUsersThisPeriod} new (${kpis.growthPct >= 0 ? "+" : ""}${kpis.growthPct}%)`,
    },
    { label: "Active Jobs", value: kpis.activeJobs, sub: null },
    {
      label: "Avg Apps / Day",
      value: kpis.avgApplicationsPerDay,
      sub: null,
    },
    {
      label: "Time-to-Hire",
      value: kpis.avgTimeToHireDays ?? "—",
      sub:
        kpis.avgTimeToHireDays != null
          ? "median (days)"
          : "no hires in period",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            {t.label}
          </h3>
          <p className="mt-3 font-mono text-3xl font-medium text-[var(--color-ink)]">
            {t.value}
          </p>
          {t.sub && (
            <p className="mt-1 text-xs text-[var(--color-muted)]">{t.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}
