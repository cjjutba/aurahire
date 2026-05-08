"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Clock,
  MapPin,
  User,
  ExternalLink,
  Package,
  ClipboardList,
} from "lucide-react";

import { AddToCalendarButton } from "@/components/interview/add-to-calendar-button";
import { WithdrawApplicationModal } from "@/components/interview/withdraw-application-modal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CandidateInterviewDetail {
  id: string;
  applicationId: string;
  scheduledAt: string;
  durationMinutes: number;
  format: string;
  status: string;
  locationOrLink: string | null;
  // Venue
  venueName: string | null;
  addressLine: string | null;
  roomOrFloor: string | null;
  mapUrl: string | null;
  reportingInstructions: string | null;
  whatToBring: string | null;
  // Interviewer
  interviewerName: string | null;
  interviewerTitle: string | null;
  // Candidate-safe feedback (only set when sharedWithCandidateAt is non-null)
  candidateSummary: string | null;
  sharedWithCandidateAt: string | null;
  // Reschedule chain
  rescheduledFromId: string | null;
  rescheduledToId: string | null;
  // Optional joined data
  job?: { id: string; title: string } | null;
  company?: { id: string; name: string; logoUrl: string | null } | null;
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, { label: string; dot: string; text: string }> = {
  scheduled: {
    label: "Scheduled",
    dot: "bg-[var(--color-status-info)]",
    text: "text-[var(--color-status-info)]",
  },
  rescheduled: {
    label: "Rescheduled",
    dot: "bg-[var(--color-status-warning)]",
    text: "text-[var(--color-status-warning)]",
  },
  completed: {
    label: "Completed",
    dot: "bg-[var(--color-status-success)]",
    text: "text-[var(--color-status-success)]",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-[var(--color-muted)]",
    text: "text-[var(--color-muted)]",
  },
  "no-show": {
    label: "No-Show",
    dot: "bg-[var(--color-status-danger)]",
    text: "text-[var(--color-status-danger)]",
  },
};

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_STYLES[status] ?? {
    label: status,
    dot: "bg-[var(--color-muted)]",
    text: "text-[var(--color-muted)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${meta.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatScheduledAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  interview: CandidateInterviewDetail;
}

export function CandidateInterviewDetailClient({ interview: iv }: Props) {
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const isUpcoming = iv.status === "scheduled" || iv.status === "rescheduled";
  const hasFeedback = !!iv.candidateSummary && !!iv.sharedWithCandidateAt;

  const jobTitle = iv.job?.title ?? "Interview";
  const companyName = iv.company?.name ?? null;

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      {/* ── Back link ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Link
          href={`/candidate/applications/${iv.applicationId}`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to application
        </Link>
      </div>

      {/* ── Header card ─────────────────────────────────────────────────── */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
              {jobTitle}
            </h1>
            {companyName && (
              <p className="text-sm text-[var(--color-body)]">at {companyName}</p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <CalendarClock
                className="h-4 w-4 shrink-0 text-[var(--color-muted)]"
                aria-hidden
              />
              <span className="text-sm text-[var(--color-body)]">
                {formatScheduledAt(iv.scheduledAt)}
              </span>
            </div>
          </div>
          <StatusPill status={iv.status} />
        </div>
      </div>

      {/* ── Schedule + Venue cards ──────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Schedule card */}
        <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Schedule
          </h2>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <CalendarClock
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-muted)]"
                aria-hidden
              />
              <span className="text-[var(--color-ink)]">
                {formatScheduledAt(iv.scheduledAt)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock
                className="h-4 w-4 shrink-0 text-[var(--color-muted)]"
                aria-hidden
              />
              <span className="font-mono text-[var(--color-body)]">
                {iv.durationMinutes} minutes
              </span>
            </div>
          </div>
        </div>

        {/* Venue card */}
        <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Venue
          </h2>
          {iv.venueName ?? iv.addressLine ? (
            <div className="space-y-1.5">
              {iv.venueName && (
                <p className="font-medium text-[var(--color-ink)]">{iv.venueName}</p>
              )}
              {iv.addressLine && (
                <div className="flex items-start gap-1.5 text-sm">
                  <MapPin
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-muted)]"
                    aria-hidden
                  />
                  <span className="text-[var(--color-body)]">
                    {iv.addressLine}
                    {iv.roomOrFloor && ` · ${iv.roomOrFloor}`}
                  </span>
                </div>
              )}
              {iv.mapUrl && (
                <a
                  href={iv.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--color-primary)] hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  View on map
                </a>
              )}
            </div>
          ) : iv.locationOrLink ? (
            <p className="break-all text-sm text-[var(--color-body)]">
              {iv.locationOrLink}
            </p>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">
              No venue specified.
            </p>
          )}
        </div>
      </div>

      {/* ── What to bring card ──────────────────────────────────────────── */}
      {iv.whatToBring && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            <Package className="h-3.5 w-3.5" aria-hidden />
            What to bring
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-body)]">
            {iv.whatToBring}
          </p>
        </div>
      )}

      {/* ── Reporting instructions card ─────────────────────────────────── */}
      {iv.reportingInstructions && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            Reporting instructions
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-body)]">
            {iv.reportingInstructions}
          </p>
        </div>
      )}

      {/* ── Interviewer card ────────────────────────────────────────────── */}
      {iv.interviewerName && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Interviewer
          </h2>
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-sm font-semibold text-[var(--color-ink)]"
            >
              {iv.interviewerName
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() ?? "")
                .join("")}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-[var(--color-ink)]">
                {iv.interviewerName}
              </p>
              {iv.interviewerTitle && (
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted)]" aria-hidden />
                  <p className="text-sm text-[var(--color-body)]">
                    {iv.interviewerTitle}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Action bar ──────────────────────────────────────────────────── */}
      {isUpcoming && (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-5 py-4">
          <AddToCalendarButton interviewId={iv.id} />
          <button
            type="button"
            onClick={() => setWithdrawOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-status-danger)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-status-danger)] transition hover:bg-[var(--color-status-danger)] hover:text-white"
          >
            Withdraw application
          </button>
        </div>
      )}

      {/* ── Recruiter feedback panel ─────────────────────────────────────── */}
      {hasFeedback && (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Recruiter feedback
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Shared on{" "}
            {new Date(iv.sharedWithCandidateAt!).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-body)]">
            {iv.candidateSummary}
          </div>
        </section>
      )}

      {/* ── Withdraw modal ───────────────────────────────────────────────── */}
      <WithdrawApplicationModal
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        applicationId={iv.applicationId}
      />
    </div>
  );
}
