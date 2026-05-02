import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { MatchBandChip } from "@/components/score/match-band-chip";

export const metadata = { title: "My Applications" };

interface AppRow {
  id: string;
  status: string;
  appliedAt: string;
  job: { title: string; company: { name: string } } | null;
  matchScore: { band: "strong" | "partial" | "limited"; overallScore: number } | null;
}

export default async function ApplicationsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/applications/mine`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return <div className="text-[var(--color-status-danger)]">Failed to load.</div>;
  }

  const body = (await res.json()) as { data: AppRow[] };

  return (
    <div className="mx-auto max-w-[1024px]">
      <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
        My Applications
      </h1>
      <p className="mt-1 text-sm text-[var(--color-body)]">
        {body.data.length} application{body.data.length === 1 ? "" : "s"}
      </p>

      {body.data.length === 0 ? (
        <div className="mt-12 rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] py-16 text-center">
          <h3 className="text-lg font-semibold text-[var(--color-ink)]">
            No applications yet
          </h3>
          <p className="mt-2 text-sm text-[var(--color-body)]">Browse jobs to apply.</p>
          <Link
            href="/candidate/jobs"
            className="mt-4 inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 py-2 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
          >
            Browse Jobs
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {body.data.map((app) => (
            <li key={app.id}>
              <Link
                href={`/candidate/applications/${app.id}`}
                className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5 transition hover:border-[var(--color-primary-soft)]"
              >
                <div>
                  <h3 className="font-semibold text-[var(--color-ink)]">
                    {app.job?.title ?? "Job"}
                  </h3>
                  <p className="text-sm text-[var(--color-body)]">
                    {app.job?.company.name ?? ""}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Applied {new Date(app.appliedAt).toLocaleDateString()} · Status:{" "}
                    {app.status}
                  </p>
                </div>
                {app.matchScore ? (
                  <div className="flex items-center gap-3">
                    <MatchBandChip band={app.matchScore.band} />
                    <span className="font-mono text-sm text-[var(--color-ink)]">
                      {app.matchScore.overallScore}/100
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-[var(--color-muted)]">
                    Score pending
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
