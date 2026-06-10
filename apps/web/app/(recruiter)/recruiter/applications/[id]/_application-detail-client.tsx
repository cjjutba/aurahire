"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  Sparkles,
  User2,
} from "lucide-react";

import {
  ScoreDashboard,
  type ScoreDashboardComponent,
} from "@/components/score/score-dashboard";
import { AnonAvatar } from "@/components/portal/anon-avatar";
import { RecruiterFairnessBanner } from "@/components/portal/recruiter-fairness-banner";

import {
  DecisionBarClient,
  type DecisionBarLatestOfferStatus,
} from "./_decision-bar-client";
import {
  RecruiterInterviewsSection,
  type InterviewRow,
} from "./_interviews-section-client";
import { RecruiterOffersSection, type OfferRow } from "./_offers-section";
import { NotesSectionClient } from "./_notes-section-client";
import { DecisionPanelClient } from "./_decision-panel-client";

const COMPONENT_LABELS: Record<string, string> = {
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  cultural_fit: "Cultural Fit",
};

// Per thesis panel revision (May 2026): "Screening" stage removed.
const APP_STATUS: Record<string, { label: string; dot: string; text: string }> =
  {
    applied: {
      label: "Applied",
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
      dot: "bg-[var(--color-status-warning)]",
      text: "text-[var(--color-status-warning)]",
    },
    offer_accepted: {
      label: "Offer Accepted",
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

export interface MatchEvidence {
  excerpt: string;
  source: string;
  relevance: "positive" | "negative" | "neutral";
  contributionPoints: number | null;
  reasoning?: string | null;
}

export interface MatchComponent {
  name: string;
  score: number;
  max: number;
  weight: number;
  explanation: string;
  evidence: MatchEvidence[];
}

export interface MatchCalibrationWarning {
  componentName: string;
  reason: "ceiling_with_thin_evidence" | "deduction_without_negative_evidence";
}

export interface MatchScoreData {
  overallScore: number;
  band: "strong" | "partial" | "limited";
  components: MatchComponent[];
  summary: string;
  redFlags: string[] | null;
  greenFlags: string[] | null;
  redactedFields?: string[];
  promptVersion?: string;
  modelUsed?: string;
  latencyMs?: number;
  calibrationWarnings?: MatchCalibrationWarning[];
}

export interface AppDetail {
  id: string;
  status: string;
  appliedAt: string;
  coverLetter: string | null;
  recruiterNotes: string | null;
  candidate: {
    id: string;
    fullName: string;
    // Per thesis panel revision (May 2026): nullable for the recruiter
    // redacted view before interview completion.
    email: string | null;
    phone: string | null;
    headline: string | null;
  } | null;
  job: { id: string; title: string; company: { name: string } } | null;
  matchScore: MatchScoreData | null;
  shortlistedAt: string | null;
  inflightSiblingsCount: number;
  /**
   * Whether the recruiter can see candidate identity and download the
   * resume. Becomes `true` once an interview on this application is
   * marked `completed`. Server-decided; do not infer from the status.
   */
  identityRevealed?: boolean;
}

interface Props {
  app: AppDetail;
  interviews: InterviewRow[];
  offers: OfferRow[];
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

// Per thesis panel revision (May 2026): `in_progress` slots above
// scheduled - the live interview is the one the recruiter is most
// interested in when scanning the decision panel.
const STATUS_PRIORITY: Record<string, number> = {
  in_progress: 0,
  scheduled: 1,
  rescheduled: 2,
  completed: 3,
  cancelled: 4,
  "no-show": 5,
};

function findLatestInterview(interviews: InterviewRow[]): InterviewRow | null {
  if (!interviews.length) return null;
  return (
    [...interviews].sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 99;
      const pb = STATUS_PRIORITY[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      const ta = a.createdAt ?? a.scheduledAt;
      const tb = b.createdAt ?? b.scheduledAt;
      return new Date(tb).getTime() - new Date(ta).getTime();
    })[0] ?? null
  );
}

export function RecruiterApplicationDetailClient({
  app,
  interviews,
  offers,
}: Props) {
  const score = app.matchScore;
  const status = APP_STATUS[app.status] ?? APP_STATUS["applied"]!;
  const candidateName = app.candidate?.fullName ?? "Unknown candidate";
  const initials = getInitials(candidateName);
  // Per thesis panel revision (May 2026): the recruiter sees an
  // anonymized avatar + skill-only profile until any interview on this
  // application is marked `completed`. After completion the server flips
  // `identityRevealed` and the full PII surfaces.
  const identityHidden = app.identityRevealed === false;
  const latestInterview = useMemo(
    () => findLatestInterview(interviews),
    [interviews],
  );
  const latestInterviewRecommendation = latestInterview?.recommendation ?? null;
  const showSchedulePrompt =
    app.status === "interview" && interviews.length === 0;

  const appliedAt = useMemo(
    () =>
      new Date(app.appliedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [app.appliedAt],
  );

  const dashboardComponents: ScoreDashboardComponent[] = useMemo(
    () =>
      (score?.components ?? []).map((c) => ({
        name: c.name,
        score: c.score,
        max: c.max,
        weight: c.weight,
        explanation: c.explanation,
        evidence: c.evidence.map((e) => ({
          excerpt: e.excerpt,
          source: e.source,
          relevance: e.relevance,
          contributionPoints: e.contributionPoints,
          reasoning: e.reasoning ?? null,
        })),
      })),
    [score?.components],
  );

  const header = (
    <div className="space-y-4">
      <Link
        href="/recruiter/applications"
        className="inline-flex items-center text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Back to applications
      </Link>
      <header className="flex min-w-0 items-start gap-3">
        {identityHidden ? (
          <AnonAvatar size="lg" />
        ) : (
          <div
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-surface-strong)] text-sm font-semibold uppercase text-[var(--color-ink)]"
          >
            {initials !== "?" ? (
              initials
            ) : (
              <User2 className="h-5 w-5 text-[var(--color-muted)]" />
            )}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-normal tracking-tight text-[var(--color-ink)]">
            {candidateName}
          </h1>
          {app.candidate?.headline && (
            <p className="mt-1 truncate text-sm text-[var(--color-body)]">
              {app.candidate.headline}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-muted)]">
            {app.candidate?.email && <span>{app.candidate.email}</span>}
            {app.candidate?.phone && (
              <span aria-hidden className="text-[var(--color-hairline)]">
                •
              </span>
            )}
            {app.candidate?.phone && <span>{app.candidate.phone}</span>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${status.text}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                aria-hidden
              />
              {status.label}
            </span>
            <span className="text-[var(--color-muted)]">
              Applied {appliedAt}
            </span>
            {app.job?.title && (
              <>
                <span aria-hidden className="text-[var(--color-hairline)]">
                  •
                </span>
                <Link
                  href={`/recruiter/jobs/${app.job.id}`}
                  className="text-[var(--color-primary)] hover:underline"
                >
                  {app.job.title}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {showSchedulePrompt && (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-lg)] bg-[var(--color-primary-soft)] px-4 py-3">
          <div className="flex items-start gap-3">
            <CalendarClock
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]"
              aria-hidden
            />
            <div>
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                Candidate is in Interview stage
              </p>
              <p className="text-sm text-[var(--color-body)]">
                Schedule the first interview to send the candidate a calendar
                invite, venue details, and reporting instructions.
              </p>
            </div>
          </div>
          <Link
            href={`/recruiter/applications/${app.id}?schedule=1`}
            replace
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
          >
            Schedule interview
          </Link>
        </div>
      )}
    </div>
  );

  const decisionBar = (
    <DecisionBarClient
      applicationId={app.id}
      currentStatus={app.status}
      shortlistedAt={app.shortlistedAt}
      latestInterviewRecommendation={latestInterviewRecommendation}
      latestOfferStatus={
        (offers[0]?.status as DecisionBarLatestOfferStatus) ?? null
      }
      siblingInflightCount={app.inflightSiblingsCount}
      candidateName={app.candidate?.fullName}
      jobTitle={app.job?.title}
      canDownloadResume={!identityHidden}
    />
  );

  if (!score) {
    return (
      <div className="mx-auto max-w-[1280px] space-y-8">
        {header}
        {identityHidden && <RecruiterFairnessBanner />}
        {decisionBar}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-8 text-center">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">
            Score pending
          </h2>
          <p className="mt-2 text-sm text-[var(--color-body)]">
            Match scoring failed or is still in progress. Refresh in a moment.
          </p>
        </div>
        <ExtraSections
          app={app}
          interviews={interviews}
          offers={offers}
          latestInterview={latestInterview}
        />
      </div>
    );
  }

  return (
    <ScoreDashboard
      header={
        <>
          {header}
          {identityHidden && (
            <div className="mt-4">
              <RecruiterFairnessBanner />
            </div>
          )}
        </>
      }
      topActions={decisionBar}
      stickyTopClass="lg:top-28"
      overallScore={score.overallScore}
      band={score.band}
      metaLines={
        <>
          <p>Applied {appliedAt}</p>
          {score.modelUsed && score.latencyMs != null && (
            <p className="font-mono text-[11px]">
              {score.latencyMs}ms · {score.modelUsed}
            </p>
          )}
        </>
      }
      components={dashboardComponents}
      componentLabels={COMPONENT_LABELS}
      calibrationNotice={null}
      beforeRightPane={
        <SummaryDisclosure
          summary={score.summary}
          greenFlags={score.greenFlags}
          redFlags={score.redFlags}
        />
      }
      extraSections={
        <ExtraSections
          app={app}
          interviews={interviews}
          offers={offers}
          latestInterview={latestInterview}
        />
      }
      fairness={
        score.redactedFields && score.promptVersion && score.modelUsed
          ? {
              redactedFields: score.redactedFields,
              promptVersion: score.promptVersion,
              modelUsed: score.modelUsed,
            }
          : null
      }
    />
  );
}

function ExtraSections({
  app,
  interviews,
  offers,
  latestInterview,
}: {
  app: AppDetail;
  interviews: InterviewRow[];
  offers: OfferRow[];
  latestInterview: InterviewRow | null;
}) {
  const showDecisionPanel =
    latestInterview !== null && latestInterview.status === "completed";

  return (
    <>
      {app.coverLetter && (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Cover Letter
          </h2>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-body)]">
            {app.coverLetter}
          </div>
        </section>
      )}

      <RecruiterInterviewsSection
        applicationId={app.id}
        interviews={interviews}
        applicationStatus={app.status}
      />

      {showDecisionPanel && latestInterview && (
        <DecisionPanelClient interview={latestInterview} />
      )}

      <RecruiterOffersSection
        applicationId={app.id}
        offers={offers}
        applicationStatus={app.status}
      />

      <NotesSectionClient
        applicationId={app.id}
        initialNotes={app.recruiterNotes ?? ""}
      />
    </>
  );
}

function SummaryDisclosure({
  summary,
  greenFlags,
  redFlags,
}: {
  summary: string;
  greenFlags: string[] | null;
  redFlags: string[] | null;
}) {
  const hasFlags =
    (greenFlags && greenFlags.length > 0) || (redFlags && redFlags.length > 0);

  return (
    <details
      className="group mb-5 rounded-[var(--radius-lg)] border border-[var(--color-hairline-soft)] bg-[var(--color-surface-soft)] p-4"
      open
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Summary
        </h3>
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted)] transition-transform group-open:rotate-90"
          aria-hidden
        />
      </summary>
      <div className="mt-3 space-y-4 text-sm leading-relaxed text-[var(--color-body)]">
        <p>{summary}</p>
        {hasFlags && (
          <div className="grid gap-3 sm:grid-cols-2">
            {greenFlags && greenFlags.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-score-high)]">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Standout Strengths
                </h4>
                <ul className="space-y-1 text-xs text-[var(--color-body)]">
                  {greenFlags.map((g, i) => (
                    <li key={i}>• {g}</li>
                  ))}
                </ul>
              </div>
            )}
            {redFlags && redFlags.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-score-low)]">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  Areas of Concern
                </h4>
                <ul className="space-y-1 text-xs text-[var(--color-body)]">
                  {redFlags.map((r, i) => (
                    <li key={i}>• {r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
