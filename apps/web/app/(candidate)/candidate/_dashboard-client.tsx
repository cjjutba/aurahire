"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Building2,
  CalendarClock,
  ChevronDown,
  FileText,
  Inbox,
  PieChart,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { matchScoreColors } from "@/components/jobs/job-card";
import { MatchBandChip } from "@/components/score/match-band-chip";
import { useMyApplicationsQuery } from "@/hooks/use-applications";
import { useMyInterviewsQuery } from "@/hooks/use-interviews";
import {
  useMyMatchPreviewsQuery,
  type MatchPreviewListItem,
} from "@/hooks/use-match-previews";
import { useProfileScoreQuery } from "@/hooks/use-profile-score";
import { useCandidateRealtime } from "@/lib/realtime/use-candidate-realtime";
import { queryKeys } from "@/lib/query";
import { ProfileScoreCardClient } from "./_components/profile-score-card-client";

type Range = "7d" | "30d" | "90d" | "all";

const RANGE_LABEL: Record<Range, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

const RANGE_DAYS: Record<Range, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
};

interface AppRow {
  id: string;
  status: string;
  appliedAt: string;
  job: {
    id?: string;
    title: string;
    company: { id?: string; name: string; logoUrl: string | null };
  } | null;
  matchScore: { band: "strong" | "partial" | "limited"; overallScore: number } | null;
}

interface InterviewRow {
  id: string;
  applicationId: string;
  scheduledAt: string;
  status: string;
  format: string;
  durationMinutes: number;
  job?: { id: string; title: string } | null;
  company?: { id: string; name: string; logoUrl: string | null } | null;
}

interface ProfileScore {
  overallScore: number;
  band: "strong" | "partial" | "limited";
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

const DEFAULT_APP_STATUS = APP_STATUS["applied"] as NonNullable<
  (typeof APP_STATUS)[string]
>;

function getAppStatus(s: string): NonNullable<(typeof APP_STATUS)[string]> {
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

const TERMINAL_STATUSES = new Set(["hired", "rejected", "withdrawn"]);

function scoreBandColor(score: number): string {
  if (score === 0) return "text-[var(--color-muted)]";
  if (score < 40) return "text-[var(--color-score-low)]";
  if (score < 70) return "text-[var(--color-score-mid)]";
  return "text-[var(--color-score-high)]";
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

function inRange(iso: string, range: Range): boolean {
  const days = RANGE_DAYS[range];
  if (days == null) return true;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(iso).getTime() >= cutoff;
}

function FirstRunWelcomeCard({ candidateName }: { candidateName: string | null }) {
  const greeting = candidateName
    ? `Welcome, ${candidateName.split(" ")[0]}.`
    : "Welcome to AuraHire.";
  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-gradient-to-br from-[var(--color-primary-soft)]/40 to-[var(--color-canvas)] p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
            {greeting}
          </h2>
          <p className="mt-2 max-w-[640px] text-sm text-[var(--color-body)]">
            You&apos;re all set. Browse open roles to start applying — AuraHire
            will score every job against your resume and explain how strongly
            you match each one.
          </p>
        </div>
        <Link
          href="/candidate/jobs"
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 text-base font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
        >
          <Search className="h-4 w-4" />
          Browse jobs
        </Link>
      </div>
    </section>
  );
}

function KpiTile({
  label,
  value,
  icon: Icon,
  description,
  tone = "neutral",
  loading = false,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  tone?: "neutral" | "warn" | "score";
  loading?: boolean;
}) {
  let valueClass = "text-[var(--color-ink)]";
  if (tone === "score") {
    if (value === 0) valueClass = "text-[var(--color-muted)]";
    else if (value < 40) valueClass = "text-[var(--color-score-low)]";
    else if (value < 70) valueClass = "text-[var(--color-score-mid)]";
    else valueClass = "text-[var(--color-score-high)]";
  } else if (tone === "warn") {
    valueClass = "text-[var(--color-status-warning)]";
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </span>
        <Icon className="h-4 w-4 text-[var(--color-muted)]" aria-hidden />
      </div>
      <div
        className={`mt-3 font-mono text-3xl font-medium ${
          loading ? "text-[var(--color-muted)]" : valueClass
        }`}
      >
        {loading ? "—" : value}
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">{description}</div>
    </div>
  );
}

function ApplicationsByStatusCard({ rows }: { rows: AppRow[] }) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }
  const total = rows.length;
  const max = Math.max(0, ...Array.from(counts.values()));

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

function UpcomingInterviewsCard({ interviews }: { interviews: InterviewRow[] }) {
  const upcoming = interviews
    .filter(
      (i) => i.status === "scheduled" && new Date(i.scheduledAt).getTime() >= Date.now(),
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    )
    .slice(0, 4);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock
            className="h-3.5 w-3.5 text-[var(--color-muted)]"
            aria-hidden
          />
          <h2 className="text-base font-semibold text-[var(--color-ink)]">
            Upcoming Interviews
          </h2>
        </div>
        {upcoming.length > 0 && (
          <Link
            href="/candidate/interviews"
            className="text-xs font-medium text-[var(--color-primary)] hover:underline"
          >
            View all →
          </Link>
        )}
      </div>

      {upcoming.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--color-muted)]">
          Will appear when scheduled.
        </div>
      ) : (
        <ul className="space-y-3">
          {upcoming.map((interview) => {
            const date = new Date(interview.scheduledAt);
            return (
              <li key={interview.id}>
                <Link
                  href={`/candidate/applications/${interview.applicationId}`}
                  className="flex items-start gap-3 rounded-[var(--radius-md)] p-2 -mx-2 transition hover:bg-[var(--color-surface-soft)]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                    <CalendarClock className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--color-ink)]">
                      {interview.job?.title ?? "Interview"}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                      {interview.company?.name ? `${interview.company.name} · ` : ""}
                      {date.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      ·{" "}
                      {date.toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RecentAppRow({ app }: { app: AppRow }) {
  const status = getAppStatus(app.status);
  return (
    <li>
      <Link
        href={`/candidate/applications/${app.id}`}
        className="flex items-center gap-4 px-4 py-3 transition hover:bg-[var(--color-surface-soft)]"
      >
        <span
          className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${status.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden />
          {status.label}
        </span>
        {app.job?.company.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={app.job.company.logoUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded-[var(--radius-sm)] object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-strong)] text-xs font-semibold text-[var(--color-ink)]">
            {getInitials(app.job?.company.name ?? "?")}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-[var(--color-ink)]">
            {app.job?.title ?? "(unknown role)"}
          </div>
          <div className="truncate text-xs text-[var(--color-muted)]">
            {app.job?.company.name ?? "(company)"}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {app.matchScore && (
            <>
              <MatchBandChip band={app.matchScore.band} className="hidden md:inline-flex" />
              <span className="font-mono text-xs">
                <span className={scoreBandColor(app.matchScore.overallScore)}>
                  {app.matchScore.overallScore}
                </span>
                <span className="text-[var(--color-muted)]">/100</span>
              </span>
            </>
          )}
          <time className="hidden text-xs text-[var(--color-muted)] sm:inline">
            {new Date(app.appliedAt).toLocaleDateString()}
          </time>
        </div>
      </Link>
    </li>
  );
}

function EmptyAppsState({ hasResume }: { hasResume: boolean }) {
  return (
    <div className="px-4 py-12 text-center">
      <Inbox className="mx-auto h-6 w-6 text-[var(--color-muted)]" aria-hidden />
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No applications yet
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        {hasResume
          ? "Browse open roles to start applying — your applications will appear here."
          : "Upload your resume, then browse open roles to start applying."}
      </div>
      <Link
        href={hasResume ? "/candidate/jobs" : "/candidate/resume"}
        className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
      >
        {hasResume ? (
          <>
            <Search className="h-3.5 w-3.5" />
            Browse jobs
          </>
        ) : (
          <>
            <FileText className="h-3.5 w-3.5" />
            Upload resume
          </>
        )}
      </Link>
    </div>
  );
}

interface CandidateDashboardClientProps {
  fullName: string | null;
  candidateId: string | null;
}

export function CandidateDashboardClient({
  fullName,
  candidateId,
}: CandidateDashboardClientProps) {
  const [range, setRange] = useState<Range>("7d");
  const qc = useQueryClient();

  const apps = useMyApplicationsQuery({});
  const interviews = useMyInterviewsQuery({});
  const profileScore = useProfileScoreQuery();
  const matchPreviews = useMyMatchPreviewsQuery();

  // Subscribe to realtime events at the dashboard root: any time a fresh
  // match-preview lands or the profile score recomputes, invalidate the
  // relevant TanStack queries so cards refresh without a manual reload.
  // The hook already filters payloads by candidateId.
  const { latestMatchPreview, latestProfileScore } = useCandidateRealtime(
    candidateId,
  );

  useEffect(() => {
    if (!latestMatchPreview) return;
    void qc.invalidateQueries({
      queryKey: ["candidate-match-previews", "list"],
    });
  }, [latestMatchPreview, qc]);

  useEffect(() => {
    if (!latestProfileScore) return;
    void qc.invalidateQueries({ queryKey: queryKeys.profileScore.me() });
  }, [latestProfileScore, qc]);

  const allApps = (apps.data?.data ?? []) as AppRow[];
  const allInterviews = (interviews.data?.data ?? []) as InterviewRow[];
  const score = ((profileScore.data as { data?: ProfileScore })?.data) ?? null;

  // Apply range filter to applications.
  const rangedApps = useMemo(
    () => allApps.filter((a) => inRange(a.appliedAt, range)),
    [allApps, range],
  );

  const activeAppCount = useMemo(
    () => allApps.filter((a) => !TERMINAL_STATUSES.has(a.status)).length,
    [allApps],
  );

  const upcomingInterviewCount = useMemo(
    () =>
      allInterviews.filter(
        (i) =>
          i.status === "scheduled" &&
          new Date(i.scheduledAt).getTime() >= Date.now(),
      ).length,
    [allInterviews],
  );

  const avgMatchScore = useMemo(() => {
    const scored = rangedApps
      .map((a) => a.matchScore?.overallScore)
      .filter((s): s is number => typeof s === "number");
    if (scored.length === 0) return 0;
    return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
  }, [rangedApps]);

  const recentApps = useMemo(
    () =>
      [...allApps]
        .sort(
          (a, b) =>
            new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime(),
        )
        .slice(0, 5),
    [allApps],
  );

  const isLoading = apps.isLoading || interviews.isLoading;
  const isFirstRun =
    !apps.isLoading &&
    !profileScore.isLoading &&
    allApps.length === 0 &&
    score == null;

  const profileScoreValue = score?.overallScore ?? 0;

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <header>
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          Welcome back{fullName ? `, ${fullName.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          Your applications and interviews at a glance.
        </p>
      </header>

      {isFirstRun && <FirstRunWelcomeCard candidateName={fullName} />}

      {/* Section 1: KPI Hero Row with date filter */}
      <section>
        <div className="mb-3 flex items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-3 text-sm font-medium text-[var(--color-ink)] disabled:opacity-60"
                  disabled={apps.isFetching}
                />
              }
            >
              <span>{RANGE_LABEL[range]}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
                <DropdownMenuItem key={r} onClick={() => setRange(r)}>
                  {RANGE_LABEL[r]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            label="Profile Score"
            value={profileScoreValue}
            icon={Sparkles}
            description={score ? "AI-computed strength" : "Not computed yet"}
            tone="score"
            loading={profileScore.isLoading}
          />
          <KpiTile
            label="Active Applications"
            value={activeAppCount}
            icon={Inbox}
            description="In progress"
            loading={apps.isLoading}
          />
          <KpiTile
            label="Upcoming Interviews"
            value={upcomingInterviewCount}
            icon={CalendarClock}
            description="Scheduled ahead"
            tone={upcomingInterviewCount > 0 ? "warn" : "neutral"}
            loading={interviews.isLoading}
          />
          <KpiTile
            label="Avg Match Score"
            value={avgMatchScore}
            icon={TrendingUp}
            description={RANGE_LABEL[range]}
            tone="score"
            loading={apps.isLoading}
          />
        </div>
      </section>

      {/* Section 2: Snapshot — profile score detail + status breakdown + interviews */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <BarChart3
            className="h-3.5 w-3.5 text-[var(--color-muted)]"
            aria-hidden
          />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Snapshot
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ProfileScoreCardClient candidateId={candidateId} />
          <ApplicationsByStatusCard rows={allApps} />
          <UpcomingInterviewsCard interviews={allInterviews} />
        </div>
      </section>

      {/* Section 2.5: Recommended for You — top auto-precomputed previews */}
      <RecommendedForYouSection
        previews={(matchPreviews.data?.data ?? []) as MatchPreviewListItem[]}
        appliedJobIds={
          new Set(
            allApps
              .map((a) => a.job?.id)
              .filter((id): id is string => !!id),
          )
        }
        loading={matchPreviews.isLoading}
        hasResume={score != null || allApps.length > 0}
      />

      {/* Section 3: Recent Applications */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox
              className="h-3.5 w-3.5 text-[var(--color-muted)]"
              aria-hidden
            />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Recent Applications
            </span>
          </div>
          {allApps.length > 0 && (
            <Link
              href="/candidate/applications"
              className="text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              View all →
            </Link>
          )}
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
          {isLoading ? (
            <div className="px-4 py-12 text-center text-sm text-[var(--color-muted)]">
              Loading applications…
            </div>
          ) : recentApps.length === 0 ? (
            <EmptyAppsState hasResume={score != null} />
          ) : (
            <ul className="divide-y divide-[var(--color-hairline-soft)]">
              {recentApps.map((app) => (
                <RecentAppRow key={app.id} app={app} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Recommended for You — top match-score previews surfaced after resume upload
// ───────────────────────────────────────────────────────────────────────

/**
 * Target slot count. The dashboard always reserves room for this many
 * previews; any unfilled slots render as shimmer cards so the section keeps
 * a stable visual rhythm while the precompute queue catches up.
 */
const RECOMMENDED_TARGET = 5;

function ShimmerCard() {
  return (
    <li
      aria-hidden
      className="h-28 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)]"
    />
  );
}

function RecommendedForYouSection({
  previews,
  appliedJobIds,
  loading,
  hasResume,
}: {
  previews: MatchPreviewListItem[];
  appliedJobIds: Set<string>;
  loading: boolean;
  hasResume: boolean;
}) {
  const qc = useQueryClient();

  // Drop previews for jobs the candidate has already applied to — those
  // belong in Recent Applications, not in "Recommended for you".
  const filtered = previews.filter((p) => !appliedJobIds.has(p.jobId));
  const top = filtered.slice(0, RECOMMENDED_TARGET);

  // Shimmer slots fill any gap between what we have and the target. Capped
  // at zero to avoid negative counts when previews exceed the target.
  const shimmerCount = Math.max(0, RECOMMENDED_TARGET - top.length);

  // Hide the section entirely for first-run candidates with no resume — the
  // welcome card already directs them to upload one.
  if (!loading && !hasResume && top.length === 0) return null;

  const refetch = (): void => {
    void qc.invalidateQueries({ queryKey: ["candidate-match-previews", "list"] });
  };

  // Empty state — precompute either failed or hasn't fired yet. Surfaces a
  // Retry + Browse all jobs CTA so the candidate is never stuck.
  if (!loading && top.length === 0) {
    return (
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles
            className="h-3.5 w-3.5 text-[var(--color-primary)]"
            aria-hidden
          />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Recommended for You
          </span>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 text-center">
          <p className="text-sm text-[var(--color-body)]">
            We&apos;re still finding the right matches for you.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={refetch}
              className="inline-flex h-9 items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
            >
              Retry
            </button>
            <Link
              href="/candidate/jobs"
              className="inline-flex h-9 items-center rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-4 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-hairline)]"
            >
              Browse all jobs
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles
            className="h-3.5 w-3.5 text-[var(--color-primary)]"
            aria-hidden
          />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Recommended for You
          </span>
          <span className="text-[11px] text-[var(--color-muted)]">
            · auto-scored against your resume
          </span>
        </div>
        <Link
          href="/candidate/jobs"
          className="text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          Browse all →
        </Link>
      </div>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {top.map((p) => (
          <RecommendedJobCard key={p.id} preview={p} />
        ))}
        {Array.from({ length: shimmerCount }).map((_, i) => (
          <ShimmerCard key={`shim-${i}`} />
        ))}
      </ul>
    </section>
  );
}

function RecommendedJobCard({ preview: p }: { preview: MatchPreviewListItem }) {
  const job = p.job;
  const company = job?.company;
  const href = job?.id ? `/candidate/jobs/${job.id}` : "/candidate/jobs";
  const colors = matchScoreColors(p.overallScore);

  return (
    <li>
      <Link
        href={href}
        className="group block rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4 transition hover:border-[var(--color-primary-soft)]"
      >
        <div className="flex items-start gap-3">
          {company?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-[var(--radius-sm)] object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-strong)] text-[var(--color-muted)]"
            >
              <Building2 className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-[var(--color-ink)] group-hover:underline">
              {job?.title ?? "Job"}
            </h3>
            <p className="truncate text-xs text-[var(--color-muted)]">
              {company?.name ?? "—"}
            </p>
          </div>
          <span className="font-mono text-base text-[var(--color-ink)]">
            {p.overallScore}
            <span className="text-xs text-[var(--color-muted)]"> / 100</span>
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <MatchBandChip band={p.band} />
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-[var(--radius-pill)]"
            style={{ backgroundColor: colors.track }}
          >
            <div
              className="h-full rounded-[var(--radius-pill)]"
              style={{
                width: `${p.overallScore}%`,
                backgroundColor: colors.fill,
              }}
            />
          </div>
        </div>
      </Link>
    </li>
  );
}
