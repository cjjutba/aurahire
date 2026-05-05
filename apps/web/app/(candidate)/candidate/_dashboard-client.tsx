"use client";

import Link from "next/link";

import { useProfileScoreQuery } from "@/hooks/use-profile-score";
import { useMyApplicationsQuery } from "@/hooks/use-applications";
import { ProfileScoreCardClient } from "./_components/profile-score-card-client";

interface CandidateDashboardClientProps {
  fullName: string | null;
}

interface AppRow {
  id: string;
  status: string;
}

export function CandidateDashboardClient({ fullName }: CandidateDashboardClientProps) {
  const apps = useMyApplicationsQuery({});
  const rows = (apps.data?.data ?? []) as AppRow[];
  const activeApplications = rows.filter(
    (a) => !["hired", "rejected", "withdrawn"].includes(a.status),
  ).length;

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Welcome back{fullName ? `, ${fullName.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          Your AuraHire dashboard.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <ProfileScoreCardClient />

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Active Applications
          </h3>
          {activeApplications === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-body)]">
              No applications yet.
            </p>
          ) : (
            <>
              <p className="mt-3 font-mono text-3xl text-[var(--color-ink)]">
                {activeApplications}
              </p>
              <Link
                href="/candidate/applications"
                className="mt-2 inline-block text-sm text-[var(--color-primary)] hover:underline"
              >
                View all →
              </Link>
            </>
          )}
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Upcoming Interviews
          </h3>
          <p className="mt-3 text-sm text-[var(--color-body)]">
            Will appear when scheduled.
          </p>
        </div>
      </div>
    </div>
  );
}
