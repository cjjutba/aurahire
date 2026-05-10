import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, Inbox, Clock, Sparkles } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";

export const metadata = { title: "Analytics" };

interface AnalyticsBody {
  data: {
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
  };
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

const STATUS_LABEL: Record<string, string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export default async function RecruiterAnalyticsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/applications/recruiter-analytics`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="text-[var(--color-status-danger)]">
        Failed to load analytics.
      </div>
    );
  }

  const body = (await res.json()) as AnalyticsBody;
  const { kpis, topJobs, applicationsByStatus } = body.data;
  const totalForBar = applicationsByStatus.reduce((s, e) => s + e.count, 0);

  const tiles = [
    { label: "Active Jobs", value: kpis.activeJobs, icon: Briefcase },
    { label: "Total Applications", value: kpis.totalApplications, icon: Inbox },
    { label: "Pending Review", value: kpis.pendingReviews, icon: Clock },
    { label: "Avg Match Score", value: kpis.avgMatchScore, icon: Sparkles },
  ];

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Recruiter Analytics
        </h1>
        <p className="mt-1 text-sm text-[var(--color-body)]">
          Performance summary across all your jobs and applications. For
          system-wide analytics see{" "}
          <Link
            href="/admin/analytics"
            className="text-[var(--color-primary)] hover:underline"
          >
            /admin/analytics
          </Link>{" "}
          (admin role only).
        </p>
      </header>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6"
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
          </div>
        ))}
      </div>

      {/* Two-column row: status breakdown + top jobs */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Status breakdown */}
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
          <h2 className="mb-1 text-base font-semibold text-[var(--color-ink)]">
            Applications by Status
          </h2>
          <p className="mb-4 text-xs text-[var(--color-muted)]">
            Where every candidate sits in your pipeline right now.
          </p>
          {totalForBar === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              No applications yet.
            </p>
          ) : (
            <div className="space-y-3">
              {applicationsByStatus.map((entry) => {
                const pct = Math.round((entry.count / totalForBar) * 100);
                return (
                  <div key={entry.status}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-[var(--color-body)]">
                        {STATUS_LABEL[entry.status] ?? entry.status}
                      </span>
                      <span className="font-mono text-[var(--color-muted)]">
                        {entry.count} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)]">
                      <div
                        className="h-2 rounded-[var(--radius-pill)] transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundColor:
                            STATUS_COLOR[entry.status] ?? "var(--color-muted)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Top jobs */}
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
          <h2 className="mb-1 text-base font-semibold text-[var(--color-ink)]">
            Top Jobs by Applications
          </h2>
          <p className="mb-4 text-xs text-[var(--color-muted)]">
            Highest-volume openings (top 5).
          </p>
          {topJobs.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              No jobs posted yet.{" "}
              <Link
                href="/recruiter/jobs/new"
                className="text-[var(--color-primary)] hover:underline"
              >
                Create your first job →
              </Link>
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-hairline-soft)]">
              {topJobs.map((j) => (
                <li key={j.jobId} className="py-3">
                  <Link
                    href={`/recruiter/jobs/${j.jobId}`}
                    className="flex items-baseline justify-between gap-3 text-sm hover:opacity-80"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[var(--color-ink)]">
                        {j.title}
                      </p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {j.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-mono text-[var(--color-ink)]">
                        {j.applicationCount} apps
                      </span>
                      {j.avgScore > 0 && (
                        <span className="font-mono text-[var(--color-muted)]">
                          avg {j.avgScore}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
