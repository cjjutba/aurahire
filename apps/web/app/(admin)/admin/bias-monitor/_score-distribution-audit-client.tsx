"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  data: Array<{
    band: "strong" | "partial" | "limited";
    count: number;
    pct: number;
  }>;
  sampleSize: number;
}

const BAND_COLOR: Record<string, string> = {
  strong: "var(--color-score-high)",
  partial: "var(--color-score-mid)",
  limited: "var(--color-score-low)",
};

const BAND_LABELS: Record<string, string> = {
  strong: "Strong (≥70)",
  partial: "Partial (40-69)",
  limited: "Limited (<40)",
};

export function ScoreDistributionAuditClient({ data, sampleSize }: Props) {
  const isEmpty = sampleSize === 0;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
      <header className="mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Score Distribution Audit
        </h3>
        <p className="mt-1 text-xs text-[var(--color-body)]">
          Match-score band distribution across all candidates this period. A
          heavy tail in one band may indicate the weights need tuning — see{" "}
          <span className="font-mono">/admin/ai-config</span> Preview Impact.
        </p>
      </header>

      {isEmpty ? (
        <div className="flex h-64 flex-col items-center justify-center gap-1 text-sm text-[var(--color-muted)]">
          <p>No match scores in this period.</p>
          <p className="text-xs">Apply to a job to populate score data.</p>
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.map((d) => ({
                ...d,
                label: BAND_LABELS[d.band] ?? d.band,
              }))}
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-hairline)"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--color-body)" }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-muted)" }}
                allowDecimals={false}
              />
              <ChartTooltip
                cursor={{ fill: "var(--color-surface-soft)" }}
                contentStyle={{
                  backgroundColor: "var(--color-canvas)",
                  border: "1px solid var(--color-hairline)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value, _name, item) => {
                  const pct =
                    (item?.payload as { pct?: number } | undefined)?.pct ?? 0;
                  return [`${value} (${pct}%)`, "Scores"];
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((entry) => (
                  <Cell
                    key={entry.band}
                    fill={BAND_COLOR[entry.band] ?? "var(--color-muted)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
