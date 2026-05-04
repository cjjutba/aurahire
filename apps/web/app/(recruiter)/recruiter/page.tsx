import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, Inbox, Clock, Sparkles, ArrowRight } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";

export const metadata = { title: "Recruiter Dashboard" };

interface StatsBody {
  data: {
    activeJobs: number;
    totalApplications: number;
    pendingReviews: number;
    avgMatchScore: number;
  };
}

interface RecentApp {
  id: string;
  status: string;
  appliedAt: string;
  candidate: { fullName: string; email: string } | null;
  job: { id: string; title: string } | null;
  matchScore: { band: "strong" | "partial" | "limited"; overallScore: number } | null;
}

const STATUS_COLOR: Record<string, string> = {
  applied: "var(--color-primary)",
  screening: "var(--color-score-mid)",
  interview: "var(--color-primary-active)",
  offer: "var(--color-score-high)",
  hired: "var(--color-score-high)",
  rejected: "var(--color-score-low)",
  withdrawn: "var(--color-muted)",
};

export default async function RecruiterDashboard() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const headers = { Authorization: `Bearer ${session.access_token}` };

  // Stats + jobs (for "Recent activity" we pull the recruiter's first 5 jobs' apps)
  const [statsRes, jobsRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/applications/recruiter-stats`, { headers, cache: "no-store" }),
    fetch(`${apiUrl}/api/v1/jobs/mine?limit=5`, { headers, cache: "no-store" }),
  ]);

  let stats = { activeJobs: 0, totalApplications: 0, pendingReviews: 0, avgMatchScore: 0 };
  if (statsRes.ok) {
    const body = (await statsRes.json()) as StatsBody;
    stats = body.data;
  }

  // Pull recent apps across the recruiter's top 5 jobs (best-effort)
  let recentApps: RecentApp[] = [];
  if (jobsRes.ok) {
    const jobsBody = (await jobsRes.json()) as { data: Array<{ id: string }> };
    const appsLists = await Promise.all(
      jobsBody.data.slice(0, 5).map((j) =>
        fetch(`${apiUrl}/api/v1/applications/by-job/${j.id}`, {
          headers,
          cache: "no-store",
        })
          .then((r) => (r.ok ? (r.json() as Promise<{ data: RecentApp[] }>) : { data: [] }))
          .then((b) => b.data)
          .catch(() => [] as RecentApp[]),
      ),
    );
    recentApps = appsLists
      .flat()
      .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
      .slice(0, 6);
  }

  const tiles = [
    { label: "Active Jobs", value: stats.activeJobs, icon: Briefcase, href: "/recruiter/jobs" },
    { label: "Applications", value: stats.totalApplications, icon: Inbox, href: "/recruiter/jobs" },
    { label: "Pending Reviews", value: stats.pendingReviews, icon: Clock, href: "/recruiter/jobs" },
    { label: "Avg Match Score", value: stats.avgMatchScore, icon: Sparkles, href: "/recruiter/analytics" },
  ];

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Recruiter Dashboard
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          Pipeline at a glance.
        </p>
      </header>

      {/* KPI tiles */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="group rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 transition hover:border-[var(--color-primary-soft)]"
          >
            <div className="flex items-start justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {label}
              </h3>
              <Icon className="h-4 w-4 text-[var(--color-muted)]" />
            </div>
            <p className="mt-3 font-mono text-3xl font-medium text-[var(--color-ink)]">
              {value}
            </p>
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <header className="mb-4 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">
            Recent applications
          </h2>
          <Link
            href="/recruiter/jobs"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
          >
            View all jobs <ArrowRight className="h-3 w-3" />
          </Link>
        </header>
        {recentApps.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            No applications yet. Once candidates apply to your jobs, they&apos;ll appear here.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-hairline-soft)]">
            {recentApps.map((app) => (
              <li key={app.id} className="py-3">
                <Link
                  href={`/recruiter/applications/${app.id}`}
                  className="flex items-baseline justify-between gap-3 hover:opacity-80"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--color-ink)]">
                      {app.candidate?.fullName ?? "(unknown candidate)"}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">
                      Applied to <strong>{app.job?.title ?? "(job)"}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {app.matchScore && (
                      <span className="font-mono text-xs text-[var(--color-ink)]">
                        {app.matchScore.overallScore}/100
                      </span>
                    )}
                    <span
                      className="rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: STATUS_COLOR[app.status] ?? "var(--color-muted)" }}
                    >
                      {app.status}
                    </span>
                    <time className="text-xs text-[var(--color-muted)]">
                      {new Date(app.appliedAt).toLocaleDateString()}
                    </time>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
