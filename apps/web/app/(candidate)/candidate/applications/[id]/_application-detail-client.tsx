"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Building2, ChevronRight, Sparkles, AlertTriangle } from "lucide-react";

import { AiShimmer } from "@/components/ai/ai-shimmer";
import {
  ScoreDashboard,
  type ScoreDashboardComponent,
} from "@/components/score/score-dashboard";

import { WithdrawButtonClient } from "./_withdraw-button-client";
import { OfferActionsClient } from "./_offer-actions-client";
import { UpcomingInterviewBannerClient } from "./_upcoming-interview-banner-client";
import { InterviewFeedbackPanelClient } from "./_interview-feedback-panel-client";

const COMPONENT_LABELS: Record<string, string> = {
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  cultural_fit: "Cultural Fit",
};

const APP_STATUS: Record<string, { label: string; dot: string; text: string }> = {
  applied:    { label: "Applied",    dot: "bg-[var(--color-status-info)]",    text: "text-[var(--color-status-info)]" },
  screening:  { label: "Screening",  dot: "bg-[var(--color-status-info)]",    text: "text-[var(--color-status-info)]" },
  interview:  { label: "Interview",  dot: "bg-[var(--color-status-info)]",    text: "text-[var(--color-status-info)]" },
  offer:      { label: "Offer",      dot: "bg-[var(--color-status-warning)]", text: "text-[var(--color-status-warning)]" },
  hired:      { label: "Hired",      dot: "bg-[var(--color-status-success)]", text: "text-[var(--color-status-success)]" },
  rejected:   { label: "Rejected",   dot: "bg-[var(--color-status-danger)]",  text: "text-[var(--color-status-danger)]" },
  withdrawn:  { label: "Withdrawn",  dot: "bg-[var(--color-muted)]",          text: "text-[var(--color-muted)]" },
};

const INTERVIEW_FORMAT_LABELS: Record<string, string> = {
  phone: "Phone",
  video: "Video",
  "in-person": "In-Person",
};

function formatSalary(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

interface MatchScoreData {
  overallScore: number;
  band: "strong" | "partial" | "limited";
  components: ScoreDashboardComponent[];
  summary: string;
  redFlags: string[] | null;
  greenFlags: string[] | null;
  redactedFields: string[];
  promptVersion: string;
  modelUsed: string;
  latencyMs: number;
}

interface InterviewRow {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  format: string;
  status: string;
  locationOrLink: string | null;
  // Venue fields (available from full InterviewDto)
  venueName?: string | null;
  addressLine?: string | null;
  roomOrFloor?: string | null;
  // Feedback fields
  candidateSummary?: string | null;
  sharedWithCandidateAt?: string | null;
}

interface OfferRow {
  id: string;
  status: string;
  title: string;
  salary: number;
  salaryCurrency: string;
  startDate: string;
  managerName: string | null;
  benefitsSummary: string | null;
  customMessage: string | null;
  expiresAt: string | null;
  sentAt: string;
  respondedAt: string | null;
}

export interface AppDetail {
  id: string;
  status: string;
  scoreStatus: "computing" | "completed" | "failed";
  appliedAt: string;
  job: {
    id: string;
    title: string;
    company: { name: string; logoUrl: string | null };
  } | null;
  matchScore: MatchScoreData | null;
}

export interface ApplicationDetailProps {
  app: AppDetail;
  interviews: InterviewRow[];
  pendingOffer: OfferRow | null;
  pastOffers: OfferRow[];
}

const INTERVIEW_STATUS_PRIORITY: Record<string, number> = {
  scheduled: 0,
  rescheduled: 1,
  completed: 2,
  cancelled: 3,
  "no-show": 4,
};

function sortInterviewsByPriority(rows: InterviewRow[]): InterviewRow[] {
  return [...rows].sort((a, b) => {
    const pa = INTERVIEW_STATUS_PRIORITY[a.status] ?? 99;
    const pb = INTERVIEW_STATUS_PRIORITY[b.status] ?? 99;
    if (pa !== pb) return pa - pb;
    return new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime();
  });
}

export function ApplicationDetailClient({
  app,
  interviews,
  pendingOffer,
  pastOffers,
}: ApplicationDetailProps) {
  const score = app.matchScore;
  const canWithdraw = !["hired", "rejected", "withdrawn"].includes(app.status);
  const status = APP_STATUS[app.status] ?? APP_STATUS["applied"]!;

  // Derive upcoming interview (scheduled or rescheduled, earliest first)
  const sorted = sortInterviewsByPriority(interviews);
  const upcomingInterview =
    sorted[0] &&
    (sorted[0].status === "scheduled" || sorted[0].status === "rescheduled")
      ? sorted[0]
      : null;

  // Derive interviews with shared feedback (candidateSummary + sharedWithCandidateAt set)
  const feedbackInterviews = interviews.filter(
    (i) => i.candidateSummary && i.sharedWithCandidateAt,
  );

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

  const header = (
    <div className="space-y-4">
      <Link
        href="/candidate/applications"
        className="inline-flex items-center text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Back to applications
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {app.job?.company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={app.job.company.logoUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-[var(--radius-md)] object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-strong)] text-[var(--color-muted)]"
            >
              <Building2 className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-normal tracking-tight text-[var(--color-ink)]">
              {app.job?.title ?? "Application"}
            </h1>
            <p className="mt-1 truncate text-sm text-[var(--color-body)]">
              at{" "}
              <strong className="text-[var(--color-ink)]">
                {app.job?.company.name ?? "—"}
              </strong>
              {app.job?.id && (
                <>
                  {" · "}
                  <Link
                    href={`/candidate/jobs/${app.job.id}`}
                    className="text-[var(--color-primary)] hover:underline"
                  >
                    View job
                  </Link>
                </>
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${status.text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden />
                {status.label}
              </span>
              <span className="text-[var(--color-muted)]">Applied {appliedAt}</span>
            </div>
          </div>
        </div>
        {canWithdraw && <WithdrawButtonClient applicationId={app.id} />}
      </header>
    </div>
  );

  const bannerAndFeedback = (
    <>
      {upcomingInterview && (
        <UpcomingInterviewBannerClient
          interview={upcomingInterview}
          applicationId={app.id}
          canWithdraw={canWithdraw}
        />
      )}
      {feedbackInterviews.map((fi) => (
        <InterviewFeedbackPanelClient
          key={fi.id}
          interview={{
            id: fi.id,
            scheduledAt: fi.scheduledAt,
            candidateSummary: fi.candidateSummary!,
            sharedWithCandidateAt: fi.sharedWithCandidateAt!,
          }}
        />
      ))}
    </>
  );

  if (!score) {
    if (app.scoreStatus === "computing") {
      return (
        <div className="mx-auto max-w-[1280px] space-y-8">
          {header}
          {bannerAndFeedback}
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-8">
            <AiShimmer
              caption="Computing your match against this job — analyzing skills, experience, education, and cultural fit..."
              height={240}
            />
          </div>
        </div>
      );
    }

    if (app.scoreStatus === "failed") {
      return (
        <div className="mx-auto max-w-[1280px] space-y-8">
          {header}
          {bannerAndFeedback}
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-status-danger)] bg-[var(--color-canvas)] p-8 text-center">
            <h2 className="text-lg font-semibold text-[var(--color-status-danger)]">
              Match score couldn&apos;t be computed
            </h2>
            <p className="mt-2 text-sm text-[var(--color-body)]">
              Our scoring engine ran into a problem. The application was saved;
              please refresh later or contact support if this persists.
            </p>
          </div>
        </div>
      );
    }

    // scoreStatus === "completed" but matchScore is missing — unexpected.
    return (
      <div className="mx-auto max-w-[1280px] space-y-8">
        {header}
        {bannerAndFeedback}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-8 text-center">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">
            Score pending
          </h2>
          <p className="mt-2 text-sm text-[var(--color-body)]">
            Try refreshing in a moment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScoreDashboard
      header={header}
      overallScore={score.overallScore}
      band={score.band}
      metaLines={
        <>
          <p>Applied {appliedAt}</p>
          <p className="font-mono text-[11px]">
            {score.latencyMs}ms · {score.modelUsed}
          </p>
        </>
      }
      components={score.components}
      componentLabels={COMPONENT_LABELS}
      beforeRightPane={
        <>
          {bannerAndFeedback}
          <SummaryDisclosure
            summary={score.summary}
            greenFlags={score.greenFlags}
            redFlags={score.redFlags}
          />
        </>
      }
      extraSections={
        <>
          {pendingOffer && <PendingOfferCard offer={pendingOffer} />}
          {pastOffers.length > 0 && (
            <section>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Offer History
              </h2>
              <ul className="space-y-2">
                {pastOffers.map((o) => (
                  <li
                    key={o.id}
                    className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <strong className="text-[var(--color-ink)]">{o.title}</strong>
                      <span className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                        {o.status}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-[var(--color-body)]">
                      {formatSalary(o.salary, o.salaryCurrency)} · {o.startDate}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {interviews.length > 0 && (
            <section>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Interviews
              </h2>
              <ul className="space-y-2">
                {interviews.map((i) => (
                  <li
                    key={i.id}
                    className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <strong className="text-[var(--color-ink)]">
                        {new Date(i.scheduledAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </strong>
                      <span className="text-xs text-[var(--color-muted)]">
                        {INTERVIEW_FORMAT_LABELS[i.format] ?? i.format} ·{" "}
                        {i.durationMinutes} min · {i.status}
                      </span>
                    </div>
                    {i.locationOrLink && (
                      <p className="mt-1 break-all text-xs text-[var(--color-body)]">
                        {i.locationOrLink}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      }
      fairness={{
        redactedFields: score.redactedFields,
        promptVersion: score.promptVersion,
        modelUsed: score.modelUsed,
      }}
    />
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
                  Significant Gaps
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

function PendingOfferCard({ offer }: { offer: OfferRow }) {
  return (
    <section className="space-y-4 rounded-[var(--radius-lg)] border-2 border-[var(--color-primary)] bg-[var(--color-primary-soft)] p-6">
      <header>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-primary)]">
          Offer Extended
        </h2>
        <p className="mt-2 text-xl font-semibold text-[var(--color-ink)]">
          {offer.title}
        </p>
      </header>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
            Salary
          </dt>
          <dd className="mt-1 font-mono text-base text-[var(--color-ink)]">
            {formatSalary(offer.salary, offer.salaryCurrency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
            Start date
          </dt>
          <dd className="mt-1 font-mono text-base text-[var(--color-ink)]">
            {offer.startDate}
          </dd>
        </div>
        {offer.managerName && (
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
              Hiring manager
            </dt>
            <dd className="mt-1 text-base text-[var(--color-ink)]">
              {offer.managerName}
            </dd>
          </div>
        )}
        {offer.expiresAt && (
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
              Respond by
            </dt>
            <dd className="mt-1 text-base text-[var(--color-ink)]">
              {new Date(offer.expiresAt).toLocaleDateString()}
            </dd>
          </div>
        )}
      </dl>
      {offer.benefitsSummary && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Benefits
          </h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-body)]">
            {offer.benefitsSummary}
          </p>
        </div>
      )}
      {offer.customMessage && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Note from the recruiter
          </h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-body)]">
            {offer.customMessage}
          </p>
        </div>
      )}
      <OfferActionsClient
        offer={{
          id: offer.id,
          status: offer.status,
          title: offer.title,
          salary: offer.salary,
          salaryCurrency: offer.salaryCurrency,
          startDate: offer.startDate,
          expiresAt: offer.expiresAt,
        }}
      />
    </section>
  );
}
