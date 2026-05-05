"use client";

import Link from "next/link";

import { MatchBandChip } from "@/components/score/match-band-chip";
import { useMyApplicationsQuery } from "@/hooks/use-applications";

interface AppRow {
  id: string;
  status: string;
  appliedAt: string;
  job: { title: string; company: { name: string } } | null;
  matchScore: { band: "strong" | "partial" | "limited"; overallScore: number } | null;
}

export function ApplicationsListClient() {
  const { data, isLoading, isError } = useMyApplicationsQuery({});

  if (isError) {
    return <div className="text-[var(--color-status-danger)]">Failed to load.</div>;
  }

  const rows = (data?.data ?? []) as AppRow[];

  return (
    <div className="mx-auto max-w-[1024px]">
      <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
        My Applications
      </h1>
      <p className="mt-1 text-sm text-[var(--color-body)]">
        {isLoading ? "—" : `${rows.length} application${rows.length === 1 ? "" : "s"}`}
      </p>

      {!isLoading && rows.length === 0 ? (
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
          {rows.map((app) => (
            <li key={app.id}>
              <Link
                href={`/candidate/applications/${app.id}`}
                className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5 transition hover:border-[var(--color-primary-soft)] sm:flex-row sm:items-center sm:justify-between"
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
