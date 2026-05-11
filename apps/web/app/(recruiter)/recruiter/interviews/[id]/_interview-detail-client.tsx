"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Clock,
  MapPin,
  User,
  ExternalLink,
  Calendar,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { getActiveCompanyId } from "@/lib/active-company";
import { RescheduleModalClient } from "@/components/interview/reschedule-modal-client";
import { FeedbackPanelClient } from "./_feedback-panel-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InterviewDetail {
  id: string;
  applicationId: string;
  scheduledBy: string;
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
  // Feedback
  feedback: string | null;
  rating: number | null;
  recommendation: "proceed" | "hold" | "reject" | null;
  candidateSummary: string | null;
  sharedWithCandidateAt: string | null;
  // Reschedule chain
  rescheduledFromId: string | null;
  rescheduledToId: string | null;
  // Related
  candidate?: { id: string; fullName: string; email: string } | null;
  job?: { id: string; title: string } | null;
  // Sibling interviews from same application (populated server-side)
  siblings?: SiblingInterview[];
}

export interface SiblingInterview {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  venueName: string | null;
  addressLine: string | null;
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<
  string,
  { label: string; dot: string; text: string }
> = {
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

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// authedFetch helper
// ---------------------------------------------------------------------------

function authedFetch(path: string, init: RequestInit): Promise<Response> {
  return (async () => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not signed in");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
    const activeCompanyId = getActiveCompanyId();
    return fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${session.access_token}`,
        ...(activeCompanyId ? { "X-Active-Company-Id": activeCompanyId } : {}),
      },
    });
  })();
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  interview: InterviewDetail;
}

export function RecruiterInterviewDetailClient({ interview: iv }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<"no-show" | "cancel" | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const isPending = pending !== null;

  const isScheduled = iv.status === "scheduled";
  const isCompleted = iv.status === "completed";
  const isActionable = isScheduled || isCompleted;

  async function patchNoShow() {
    setPending("no-show");
    try {
      const res = await authedFetch(`/api/v1/interviews/${iv.id}/no-show`, {
        method: "PATCH",
      });
      if (!res.ok) {
        toastApiError(null, "Couldn't mark no-show", "Please try again.");
        return;
      }
      toastSuccess("Marked as no-show");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function patchCancel() {
    setPending("cancel");
    try {
      const res = await authedFetch(`/api/v1/interviews/${iv.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus: "cancelled" }),
      });
      if (!res.ok) {
        toastApiError(null, "Couldn't cancel interview", "Please try again.");
        return;
      }
      toastSuccess("Interview cancelled");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  function openIcs() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
    // Auth header can't be passed in new tab, fetch and blob instead.
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const activeCompanyId = getActiveCompanyId();
      const res = await fetch(`${apiUrl}/api/v1/interviews/${iv.id}/ics`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          ...(activeCompanyId
            ? { "X-Active-Company-Id": activeCompanyId }
            : {}),
        },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `interview-${iv.id}.ics`;
      a.click();
      URL.revokeObjectURL(url);
    })().catch(() => {});
  }

  const candidateName = iv.candidate?.fullName ?? "Candidate";

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      {/* ── Back link ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Link
          href="/recruiter/interviews"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All interviews
        </Link>
        {iv.applicationId && (
          <>
            <span className="text-[var(--color-hairline)]">·</span>
            <Link
              href={`/recruiter/applications/${iv.applicationId}`}
              className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              Application
            </Link>
          </>
        )}
      </div>

      {/* ── Header card ─────────────────────────────────────────────────── */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
              {candidateName}
            </h1>
            {iv.job && (
              <p className="text-sm text-[var(--color-body)]">{iv.job.title}</p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <CalendarClock
                className="h-4 w-4 shrink-0 text-[var(--color-muted)]"
                aria-hidden
              />
              <span className="text-sm text-[var(--color-body)]">
                {formatScheduledAt(iv.scheduledAt)}
              </span>
              <span className="text-xs text-[var(--color-muted)]">
                · {iv.durationMinutes} min
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
          <button
            type="button"
            onClick={openIcs}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-1.5 text-xs font-medium text-[var(--color-body)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]"
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            Add to calendar
          </button>
        </div>

        {/* Venue card */}
        <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Venue
          </h2>
          {iv.venueName || iv.addressLine ? (
            <div className="space-y-1.5">
              {iv.venueName && (
                <p className="font-medium text-[var(--color-ink)]">
                  {iv.venueName}
                </p>
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

      {/* ── Candidate info card ─────────────────────────────────────────── */}
      {iv.candidate && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Candidate
          </h2>
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-sm font-semibold text-[var(--color-ink)]"
            >
              {iv.candidate.fullName
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() ?? "")
                .join("")}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-[var(--color-ink)]">
                {iv.candidate.fullName}
              </p>
              <div className="flex items-center gap-1.5">
                <User
                  className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted)]"
                  aria-hidden
                />
                <p className="text-sm text-[var(--color-body)]">
                  {iv.candidate.email}
                </p>
              </div>
            </div>
            <Link
              href={`/recruiter/applications/${iv.applicationId}`}
              className="ml-auto inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-1.5 text-xs font-medium text-[var(--color-body)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]"
            >
              View application
              <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        </div>
      )}

      {/* ── Interviewer info ────────────────────────────────────────────── */}
      {iv.interviewerName && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Interviewer
          </h2>
          <p className="text-sm font-medium text-[var(--color-ink)]">
            {iv.interviewerName}
          </p>
          {iv.interviewerTitle && (
            <p className="text-sm text-[var(--color-body)]">
              {iv.interviewerTitle}
            </p>
          )}
        </div>
      )}

      {/* ── Action bar ──────────────────────────────────────────────────── */}
      {isActionable && (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-5 py-4">
          {isScheduled && (
            <Button
              onClick={() => setRescheduleOpen(true)}
              disabled={isPending}
              className="rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] text-[var(--color-ink)] hover:bg-[var(--color-hairline)]"
            >
              Reschedule
            </Button>
          )}
          <button
            type="button"
            onClick={patchNoShow}
            disabled={isPending || (!isScheduled && !isCompleted)}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-body)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)] disabled:opacity-60"
          >
            {pending === "no-show" && <ButtonSpinner />}
            Mark No-Show
          </button>
          {isScheduled && (
            <button
              type="button"
              onClick={patchCancel}
              disabled={isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-status-danger)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-status-danger)] transition hover:bg-[var(--color-status-danger)] hover:text-[var(--color-on-primary)] disabled:opacity-60"
            >
              {pending === "cancel" && <ButtonSpinner />}
              Cancel
            </button>
          )}
        </div>
      )}

      {/* ── Feedback panel ──────────────────────────────────────────────── */}
      <FeedbackPanelClient
        interview={{
          id: iv.id,
          feedback: iv.feedback,
          rating: iv.rating,
          recommendation: iv.recommendation,
          candidateSummary: iv.candidateSummary,
          sharedWithCandidateAt: iv.sharedWithCandidateAt,
        }}
      />

      {/* ── Past interviews chain ───────────────────────────────────────── */}
      {iv.siblings && iv.siblings.length > 0 && (
        <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Other interviews for this application
          </h2>
          <ul className="space-y-2">
            {iv.siblings.map((sib) => {
              const sibMeta = STATUS_STYLES[sib.status] ?? {
                label: sib.status,
                dot: "bg-[var(--color-muted)]",
                text: "text-[var(--color-muted)]",
              };
              return (
                <li
                  key={sib.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-4 py-3 text-sm"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium text-[var(--color-ink)]">
                      {formatShortDate(sib.scheduledAt)}
                      <span className="ml-2 font-mono text-xs text-[var(--color-muted)]">
                        {sib.durationMinutes} min
                      </span>
                    </p>
                    {(sib.venueName || sib.addressLine) && (
                      <p className="text-xs text-[var(--color-muted)]">
                        {sib.venueName}
                        {sib.addressLine && ` · ${sib.addressLine}`}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${sibMeta.text}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${sibMeta.dot}`}
                      aria-hidden
                    />
                    {sibMeta.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── Reschedule modal ────────────────────────────────────────────── */}
      <RescheduleModalClient
        interviewId={iv.id}
        applicationId={iv.applicationId}
        defaults={{
          scheduledAt: iv.scheduledAt,
          durationMinutes: iv.durationMinutes,
          venueName: iv.venueName ?? undefined,
          addressLine: iv.addressLine ?? undefined,
          roomOrFloor: iv.roomOrFloor,
          mapUrl: iv.mapUrl,
          reportingInstructions: iv.reportingInstructions,
          whatToBring: iv.whatToBring,
          interviewerName: iv.interviewerName,
          interviewerTitle: iv.interviewerTitle,
        }}
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
      />
    </div>
  );
}
