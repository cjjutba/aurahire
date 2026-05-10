"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";

import { MatchBandChip } from "@/components/score/match-band-chip";
import { useRecruiterApplicationsByJobQuery } from "@/hooks/use-applications";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { useRealtimeRoom } from "@/hooks/use-realtime-room";
import { RealtimeEvent } from "@/lib/realtime";

interface ApplicationsClientProps {
  jobId: string;
  jobTitle: string;
}

export function ApplicationsClient({
  jobId,
  jobTitle,
}: ApplicationsClientProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useRecruiterApplicationsByJobQuery(
    jobId,
    {},
  );

  // Subscribe to the job-scoped room so the gateway delivers job:{id} events.
  useRealtimeRoom("job", jobId);

  useRealtimeChannel(RealtimeEvent.ApplicationCreated, (payload) => {
    if (payload.jobId !== jobId) return;
    void queryClient.invalidateQueries({
      queryKey: ["recruiter-applications", "by-job", jobId],
    });
  });

  useRealtimeChannel(RealtimeEvent.ApplicationStatusChanged, (payload) => {
    if (payload.jobId !== jobId) return;
    void queryClient.invalidateQueries({
      queryKey: ["recruiter-applications", "by-job", jobId],
    });
  });

  const apps = (data?.data ?? []) as Array<{
    id: string;
    status: string;
    appliedAt: string;
    candidate: {
      fullName: string;
      email: string;
      headline: string | null;
    } | null;
    matchScore: {
      band: "strong" | "partial" | "limited";
      overallScore: number;
    } | null;
  }>;

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
          {jobTitle}
        </h1>
        {!isLoading && (
          <p className="mt-1 text-sm text-[var(--color-body)]">
            {apps.length} application{apps.length === 1 ? "" : "s"} · Sorted by
            best match
          </p>
        )}
      </header>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-surface-strong)]"
            />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-sm text-[var(--color-status-danger)]">
          Failed to load applications.
        </div>
      )}

      {!isLoading && !isError && apps.length === 0 && (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] py-12 text-center text-[var(--color-body)]">
          No applications yet.
        </div>
      )}

      {!isLoading && !isError && apps.length > 0 && (
        <ul className="space-y-3">
          {apps.map((app) => (
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
                    Applied {new Date(app.appliedAt).toLocaleDateString()} ·
                    Status: {app.status}
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
