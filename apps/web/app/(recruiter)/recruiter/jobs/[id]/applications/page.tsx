import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { MatchBandChip } from "@/components/score/match-band-chip";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface AppRow {
  id: string;
  status: string;
  appliedAt: string;
  candidate: {
    fullName: string;
    email: string;
    headline: string | null;
  } | null;
  matchScore: { band: "strong" | "partial" | "limited"; overallScore: number } | null;
}

export const metadata = { title: "Applications" };

export default async function JobApplicationsPage({ params }: PageProps) {
  const { id: jobId } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const [jobRes, appsRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/jobs/${jobId}/for-recruiter`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    }),
    fetch(`${apiUrl}/api/v1/applications/by-job/${jobId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    }),
  ]);

  if (jobRes.status === 404) notFound();
  if (!jobRes.ok || !appsRes.ok) {
    return <div className="text-[var(--color-status-danger)]">Failed to load.</div>;
  }

  const jobBody = (await jobRes.json()) as { data: { id: string; title: string } };
  const appsBody = (await appsRes.json()) as { data: AppRow[] };

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <Link
        href={`/recruiter/jobs/${jobId}`}
        className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Back to job
      </Link>
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          {jobBody.data.title}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-body)]">
          {appsBody.data.length} application{appsBody.data.length === 1 ? "" : "s"} ·
          Sorted by best match
        </p>
      </header>

      {appsBody.data.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] py-12 text-center text-[var(--color-body)]">
          No applications yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {appsBody.data.map((app) => (
            <li key={app.id}>
              <Link
                href={`/recruiter/applications/${app.id}`}
                className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5 transition hover:border-[var(--color-primary-soft)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <h3 className="font-semibold text-[var(--color-ink)]">
                    {app.candidate?.fullName ?? "Unknown"}
                  </h3>
                  <p className="text-sm text-[var(--color-body)]">
                    {app.candidate?.headline ?? app.candidate?.email}
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
