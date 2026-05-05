import { redirect } from "next/navigation";
import { Briefcase, Inbox } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import { PipelineAnalyticsCard, type PipelineAnalyticsData } from "./_dashboard-client";

export const metadata = { title: "Recruiter Dashboard" };

interface JobWithStats {
  id: string;
  title: string;
  status: "draft" | "published" | "closed" | "archived";
  workMode: string;
  employmentType: string;
  locationCountry: string | null;
  salaryMin: string | null;
  salaryMax: string | null;
  salaryCurrency: string | null;
  publishedAt: string | null;
  stats: {
    candidates: number;
    new: number;
    interviewed: number;
    offered: number;
    hired: number;
    avgScore: number;
  };
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

const JOB_STATUS: Record<
  string,
  { label: string; dot: string; text: string }
> = {
  published: {
    label: "Published",
    dot: "bg-[var(--color-status-success)]",
    text: "text-[var(--color-status-success)]",
  },
  draft: {
    label: "Draft",
    dot: "bg-[var(--color-muted)]",
    text: "text-[var(--color-muted)]",
  },
  closed: {
    label: "Closed",
    dot: "bg-[var(--color-status-danger)]",
    text: "text-[var(--color-status-danger)]",
  },
  archived: {
    label: "Archived",
    dot: "bg-[var(--color-muted)]",
    text: "text-[var(--color-muted)]",
  },
};

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

  const [jobsRes, statsRes, recentRes] = await Promise.all([
    fetch(
      `${apiUrl}/api/v1/jobs/mine?include=stats&sort=recent-activity&limit=5`,
      { headers, cache: "no-store" },
    ),
    fetch(`${apiUrl}/api/v1/applications/recruiter-stats?range=7d`, {
      headers,
      cache: "no-store",
    }),
    fetch(`${apiUrl}/api/v1/applications/recent?limit=6`, {
      headers,
      cache: "no-store",
    }),
  ]);

  const jobs: JobWithStats[] = jobsRes.ok
    ? ((await jobsRes.json()) as { data: JobWithStats[] }).data
    : [];

  const initialStats: PipelineAnalyticsData = statsRes.ok
    ? (await statsRes.json()).data
    : {
        activeJobs: 0,
        totalApps: 0,
        pendingReview: 0,
        inInterview: 0,
        offered: 0,
        hired: 0,
        avgMatchScore: 0,
        biasFlags: 0,
      };

  const recent: RecentApp[] = recentRes.ok
    ? ((await recentRes.json()) as { data: RecentApp[] }).data
    : [];

  async function fetchStats(
    range: "7d" | "30d" | "90d" | "all",
  ): Promise<PipelineAnalyticsData> {
    "use server";
    const res = await fetch(
      `${apiUrl}/api/v1/applications/recruiter-stats?range=${range}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
    if (!res.ok) throw new Error("Failed to fetch stats");
    const body = (await res.json()) as { data: PipelineAnalyticsData };
    return body.data;
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <header>
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          Recruiter Dashboard
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">Pipeline at a glance.</p>
      </header>

      {/* Section 1: Active Jobs */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-3.5 w-3.5 text-[var(--color-muted)]" aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Active Jobs
            </span>
          </div>
          <a
            href="/recruiter/jobs"
            className="text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            View all jobs →
          </a>
        </div>
        {jobs.length === 0 ? (
          <EmptyJobsState />
        ) : (
          <ul className="space-y-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </ul>
        )}
      </section>

      {/* Section 2: Pipeline Analytics */}
      <PipelineAnalyticsCard
        initialRange="7d"
        initialData={initialStats}
        fetchForRange={fetchStats}
      />

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

const DEFAULT_JOB_STATUS = { label: "Draft", dot: "bg-[var(--color-muted)]", text: "text-[var(--color-muted)]" };
const DEFAULT_APP_STATUS = { label: "Applied", dot: "bg-[var(--color-status-info)]", text: "text-[var(--color-status-info)]" };

function JobCard({ job }: { job: JobWithStats }) {
  const status = JOB_STATUS[job.status] ?? DEFAULT_JOB_STATUS;
  const subtitle = [
    job.workMode,
    job.employmentType,
    job.locationCountry,
    job.salaryMin && job.salaryMax
      ? `${formatSalary(job.salaryMin)}–${formatSalary(job.salaryMax)} ${job.salaryCurrency ?? "USD"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <a
        href={`/recruiter/jobs/${job.id}`}
        className="block rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 transition hover:border-[var(--color-primary-soft)]"
      >
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${status.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden />
            {status.label}
          </span>
          {job.publishedAt && (
            <span className="text-xs text-[var(--color-muted)]">
              · Posted{" "}
              {new Date(job.publishedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
        </div>
        <div className="mt-3 text-base font-semibold text-[var(--color-ink)]">
          {job.title}
        </div>
        <div className="mt-1 text-sm text-[var(--color-body)]">{subtitle}</div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--color-hairline-soft)] pt-4 md:grid-cols-6">
          <Metric label="Candidates" value={job.stats.candidates} />
          <Metric label="New" value={job.stats.new} />
          <Metric label="Interviewed" value={job.stats.interviewed} />
          <Metric label="Offered" value={job.stats.offered} />
          <Metric label="Hired" value={job.stats.hired} />
          <Metric
            label="Avg Score"
            value={job.stats.avgScore}
            valueClass={scoreBandColor(job.stats.avgScore)}
          />
        </div>
      </a>
    </li>
  );
}

function Metric({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className={`mt-1 font-mono text-base font-medium ${valueClass ?? "text-[var(--color-ink)]"}`}>
        {value}
      </div>
    </div>
  );
}

function RecentAppRow({ app }: { app: RecentApp }) {
  const status = APP_STATUS[app.status] ?? DEFAULT_APP_STATUS;
  return (
    <li>
      <a
        href={`/recruiter/applications/${app.id}`}
        className="flex items-center gap-4 px-4 py-3 transition hover:bg-[var(--color-surface-soft)]"
      >
        <span
          className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${status.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden />
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
            Applied to <strong className="font-semibold">{app.job?.title ?? "(job)"}</strong>
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

function EmptyJobsState() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <Briefcase className="mx-auto h-6 w-6 text-[var(--color-muted)]" aria-hidden />
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">No active jobs</div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        Post your first opening to start collecting candidates.
      </div>
      <a
        href="/recruiter/jobs/new"
        className="mt-4 inline-flex h-11 items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
      >
        + Create your first job
      </a>
    </div>
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

function formatSalary(s: string): string {
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return n.toLocaleString();
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
