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
  data: Array<{ category: string; count: number; pct: number }>;
}

const CATEGORY_COLOR: Record<string, string> = {
  gendered: "var(--color-score-mid)",
  "age-coded": "var(--color-score-mid-soft)",
  ableist: "var(--color-status-danger)",
  exclusionary: "var(--color-score-low-soft)",
  other: "var(--color-muted)",
};

const CATEGORY_LABELS: Record<string, string> = {
  gendered: "Gendered",
  "age-coded": "Age-coded",
  ableist: "Ableist",
  exclusionary: "Exclusionary",
  other: "Other",
};

export function FlagBreakdownChartClient({ data }: Props) {
  const isEmpty = data.length === 0 || data.every((d) => d.count === 0);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
      <header className="mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Flag Breakdown by Category
        </h3>
        <p className="mt-1 text-xs text-[var(--color-body)]">
          Where the AI is finding bias. Concentration in one category may
          indicate a categorical blind spot or a recurring recruiter pattern.
        </p>
      </header>

      {isEmpty ? (
        <div className="flex h-64 flex-col items-center justify-center gap-1 text-sm text-[var(--color-muted)]">
          <p>No flags in this period.</p>
          <p className="text-xs">
            Either no problematic descriptions, or no jobs were published.
          </p>
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.map((d) => ({
                ...d,
                label: CATEGORY_LABELS[d.category] ?? d.category,
              }))}
              layout="vertical"
              margin={{ top: 5, right: 30, bottom: 5, left: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-hairline)"
              />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: "var(--color-muted)" }}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--color-body)" }}
                width={90}
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
                  return [`${value} (${pct}%)`, "Flags"];
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((entry) => (
                  <Cell
                    key={entry.category}
                    fill={
                      CATEGORY_COLOR[entry.category] ?? "var(--color-muted)"
                    }
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
