import { redirect } from "next/navigation";
import { BarChart3, Inbox, PieChart, TrendingUp } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import { KpiHeroRow, type KpiData } from "./_dashboard-client";

export const metadata = { title: "Recruiter Dashboard" };

interface AnalyticsData {
  kpis: {
    activeJobs: number;
    totalApplications: number;
    pendingReviews: number;
    avgMatchScore: number;
  };
  topJobs: Array<{
    jobId: string;
    title: string;
    status: string;
    applicationCount: number;
    avgScore: number;
  }>;
  applicationsByStatus: Array<{ status: string; count: number }>;
}

interface RecentApp {
  id: string;
  status: string;
  appliedAt: string;
  candidate: { fullName: string; email: string } | null;
  job: { id: string; title: string } | null;
  matchScore: { band: string; overallScore: number } | null;
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

function getAppStatus(
  s: string,
): NonNullable<(typeof APP_STATUS)[string]> {
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

export default async function RecruiterDashboard() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const headers = { Authorization: `Bearer ${session.access_token}` };
  const accessToken = session.access_token;

  const [statsRes, analyticsRes, recentRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/applications/recruiter-stats?range=7d`, {
      headers,
      cache: "no-store",
    }),
    fetch(`${apiUrl}/api/v1/applications/recruiter-analytics`, {
      headers,
      cache: "no-store",
    }),
    fetch(`${apiUrl}/api/v1/applications/recent?limit=6`, {
      headers,
      cache: "no-store",
    }),
  ]);

  const initialKpis: KpiData = statsRes.ok
    ? extractKpis(await statsRes.json())
    : { activeJobs: 0, totalApps: 0, pendingReview: 0, avgMatchScore: 0 };

  const analytics: AnalyticsData = analyticsRes.ok
    ? (await analyticsRes.json()).data
    : {
        kpis: {
          activeJobs: 0,
          totalApplications: 0,
          pendingReviews: 0,
          avgMatchScore: 0,
        },
        topJobs: [],
        applicationsByStatus: [],
      };

  const recent: RecentApp[] = recentRes.ok
    ? ((await recentRes.json()) as { data: RecentApp[] }).data
    : [];

  async function fetchKpis(
    range: "7d" | "30d" | "90d" | "all",
  ): Promise<KpiData> {
    "use server";
    const res = await fetch(
      `${apiUrl}/api/v1/applications/recruiter-stats?range=${range}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
    if (!res.ok) throw new Error("Failed to fetch stats");
    return extractKpis(await res.json());
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          Recruiter Dashboard
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          Pipeline at a glance.
        </p>
      </header>

      {/* Section 1: KPI Hero Row with date filter */}
      <KpiHeroRow
        initialRange="7d"
        initialData={initialKpis}
        fetchForRange={fetchKpis}
      />

      {/* Section 2: Pipeline Snapshot */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5 text-[var(--color-muted)]" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Pipeline Snapshot
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ApplicationsByStatusCard data={analytics.applicationsByStatus} />
          <TopJobsByVolumeCard data={analytics.topJobs} />
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
          {recent.length === 0 ? (
            <EmptyAppsState />
          ) : (
            <ul className="divide-y divide-[var(--color-hairline-soft)]">
              {recent.map((app) => (
                <RecentAppRow key={app.id} app={app} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function extractKpis(body: unknown): KpiData {
  const data = (body as { data?: Record<string, number> }).data ?? {};
  return {
    activeJobs: data.activeJobs ?? 0,
    totalApps: data.totalApps ?? data.totalApplications ?? 0,
    pendingReview: data.pendingReview ?? data.pendingReviews ?? 0,
    avgMatchScore: data.avgMatchScore ?? 0,
  };
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

function EmptyAppsState() {
  return (
    <div className="px-4 py-12 text-center">
      <Inbox className="mx-auto h-6 w-6 text-[var(--color-muted)]" aria-hidden />
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No applications yet
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        Once candidates apply to your jobs, they&apos;ll appear here.
      </div>
    </div>
  );
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
