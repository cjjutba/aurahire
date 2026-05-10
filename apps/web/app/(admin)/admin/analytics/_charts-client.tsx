// Recharts ^3 — chart visualizations for /admin/analytics. Pinned per docs/main/tech-stack.md.
"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  charts: {
    userGrowth: Array<{
      date: string;
      candidate: number;
      recruiter: number;
      admin: number;
    }>;
    jobsOverTime: Array<{
      date: string;
      draft: number;
      published: number;
      archived: number;
    }>;
    applicationsByStatus: Array<{
      date: string;
      applied: number;
      screening: number;
      interview: number;
      offer: number;
      hired: number;
      rejected: number;
      withdrawn: number;
    }>;
    scoreDistribution: Array<{ bucket: string; count: number }>;
    aiProcessingTime: Array<{
      date: string;
      avgParseMs: number;
      avgScoreMs: number;
    }>;
    topRecruiters: Array<{
      recruiterId: string;
      fullName: string;
      jobCount: number;
      applicationCount: number;
    }>;
  };
}

const ROLE_COLORS: Record<string, string> = {
  candidate: "var(--color-primary)",
  recruiter: "var(--color-score-high)",
  admin: "var(--color-score-mid)",
};

const STATUS_COLORS: Record<string, string> = {
  applied: "var(--color-primary)",
  screening: "var(--color-score-mid)",
  interview: "var(--color-primary-active)",
  offer: "var(--color-score-high)",
  hired: "var(--color-score-high)",
  rejected: "var(--color-score-low)",
  withdrawn: "var(--color-muted)",
};

const JOB_STATUS_COLORS: Record<string, string> = {
  draft: "var(--color-muted)",
  published: "var(--color-score-high)",
  archived: "var(--color-status-danger)",
};

function ChartCard({
  title,
  children,
  isEmpty,
  emptyMessage,
}: {
  title: string;
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {title}
      </h3>
      {isEmpty ? (
        <div className="flex h-64 items-center justify-center text-sm text-[var(--color-muted)]">
          {emptyMessage ?? "No data in this period"}
        </div>
      ) : (
        <div className="h-64">{children}</div>
      )}
    </div>
  );
}

function bucketColor(bucket: string): string {
  const start = parseInt(bucket.split("-")[0]!, 10);
  if (start >= 70) return "var(--color-score-high)";
  if (start >= 40) return "var(--color-score-mid)";
  return "var(--color-score-low)";
}

const APPLICATION_STATUSES = [
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
] as const;

export function ChartsClient({ charts }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="User Growth" isEmpty={charts.userGrowth.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={charts.userGrowth}
            margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-hairline)"
            />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="candidate"
              stroke={ROLE_COLORS.candidate}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="recruiter"
              stroke={ROLE_COLORS.recruiter}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="admin"
              stroke={ROLE_COLORS.admin}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Jobs Over Time"
        isEmpty={charts.jobsOverTime.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={charts.jobsOverTime}
            margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-hairline)"
            />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="draft"
              stroke={JOB_STATUS_COLORS.draft}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="published"
              stroke={JOB_STATUS_COLORS.published}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="archived"
              stroke={JOB_STATUS_COLORS.archived}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Applications by Status"
        isEmpty={charts.applicationsByStatus.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={charts.applicationsByStatus}
            margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-hairline)"
            />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {APPLICATION_STATUSES.map((s) => (
              <Area
                key={s}
                type="monotone"
                dataKey={s}
                stackId="1"
                stroke={STATUS_COLORS[s]}
                fill={STATUS_COLORS[s]}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Score Distribution"
        isEmpty={charts.scoreDistribution.every((b) => b.count === 0)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={charts.scoreDistribution}
            margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-hairline)"
            />
            <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="count">
              {charts.scoreDistribution.map((entry) => (
                <Cell key={entry.bucket} fill={bucketColor(entry.bucket)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="AI Processing Time (ms)"
        isEmpty={charts.aiProcessingTime.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={charts.aiProcessingTime}
            margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-hairline)"
            />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="avgParseMs"
              name="Resume parse"
              stroke="var(--color-primary)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="avgScoreMs"
              name="Match score"
              stroke="var(--color-score-high)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Top Recruiters"
        isEmpty={charts.topRecruiters.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={charts.topRecruiters.map((r) => ({
              name: r.fullName,
              jobs: r.jobCount,
              apps: r.applicationCount,
            }))}
            layout="vertical"
            margin={{ top: 5, right: 5, bottom: 5, left: 80 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-hairline)"
            />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 10 }}
              width={80}
            />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="jobs" name="Jobs" fill="var(--color-primary)" />
            <Bar
              dataKey="apps"
              name="Applications"
              fill="var(--color-score-high)"
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
