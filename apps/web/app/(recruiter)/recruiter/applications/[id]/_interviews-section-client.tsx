"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronDown, CalendarClock, MapPin, User, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { getActiveCompanyId } from "@/lib/active-company";
import { ScheduleInterviewSheetClient } from "./_schedule-interview-sheet-client";
import { RescheduleModalClient } from "@/components/interview/reschedule-modal-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InterviewRow {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  format: string;
  status: string;
  // Legacy
  locationOrLink?: string | null;
  // v2 venue fields
  venueName?: string | null;
  addressLine?: string | null;
  roomOrFloor?: string | null;
  interviewerName?: string | null;
  interviewerTitle?: string | null;
  recommendation?: "proceed" | "hold" | "reject" | null;
  candidateSummary?: string | null;
  sharedWithCandidateAt?: string | null;
  rescheduledFromId?: string | null;
  rescheduledToId?: string | null;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Per thesis panel revision (May 2026): `in_progress` slots between
// scheduled and completed — the interview is happening right now.
const STATUS_PRIORITY: Record<string, number> = {
  in_progress: 0,
  scheduled: 1,
  rescheduled: 2,
  completed: 3,
  cancelled: 4,
  "no-show": 5,
};

const STATUS_LABELS: Record<
  string,
  { label: string; dot: string; text: string }
> = {
  scheduled: {
    label: "Scheduled",
    dot: "bg-[var(--color-status-info)]",
    text: "text-[var(--color-status-info)]",
  },
  // Animated pulsing dot to telegraph the live state.
  in_progress: {
    label: "In Progress",
    dot: "bg-[var(--color-primary)] animate-pulse",
    text: "text-[var(--color-primary)]",
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sort interviews: by status priority first, then by createdAt DESC. */
function sortInterviews(interviews: InterviewRow[]): InterviewRow[] {
  return [...interviews].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 99;
    const pb = STATUS_PRIORITY[b.status] ?? 99;
    if (pa !== pb) return pa - pb;
    // Within same priority, most recent first
    const ta = a.createdAt ?? a.scheduledAt;
    const tb = b.createdAt ?? b.scheduledAt;
    return new Date(tb).getTime() - new Date(ta).getTime();
  });
}

function formatScheduledAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

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
// StatusPill
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_LABELS[status] ?? {
    label: status,
    dot: "bg-[var(--color-muted)]",
    text: "text-[var(--color-muted)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${meta.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// InterviewCard
// ---------------------------------------------------------------------------

interface InterviewCardProps {
  interview: InterviewRow;
  /** The parent application ID, needed for reschedule conflict checks. */
  applicationId: string;
  /** When true, action buttons are rendered. */
  showActions: boolean;
}

function InterviewCard({
  interview: iv,
  applicationId,
  showActions,
}: InterviewCardProps) {
  const router = useRouter();
  const [pending, setPending] = useState<
    "no-show" | "cancel" | "complete" | null
  >(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const isPending = pending !== null;

  const scheduledLabel = formatScheduledAt(iv.scheduledAt);

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

  /**
   * Mark the interview as completed before the duration ends. Per
   * thesis panel revision (May 2026): recruiters don't have to wait
   * for the autocomplete cron — they can flip status the moment the
   * interview wraps up. The same path is what unlocks candidate
   * identity reveal + resume download on the application.
   */
  async function patchComplete() {
    setPending("complete");
    try {
      const res = await authedFetch(`/api/v1/interviews/${iv.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus: "completed" }),
      });
      if (!res.ok) {
        toastApiError(
          null,
          "Couldn't mark complete",
          "Please try again.",
        );
        return;
      }
      toastSuccess(
        "Interview completed",
        "Candidate details and resume are now unlocked.",
      );
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  const isScheduled = iv.status === "scheduled";
  const isInProgress = iv.status === "in_progress";
  const isCompleted = iv.status === "completed";
  const isReadOnly =
    iv.status === "cancelled" ||
    iv.status === "no-show" ||
    iv.status === "rescheduled";

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-4 text-sm">
      {/* ── Header row ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock
            className="h-4 w-4 shrink-0 text-[var(--color-muted)]"
            aria-hidden
          />
          <strong className="text-[var(--color-ink)]">{scheduledLabel}</strong>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {iv.durationMinutes} min
          </span>
          <StatusPill status={iv.status} />
        </div>
      </div>

      {/* ── Venue summary ──────────────────────────────────────────────── */}
      {(iv.venueName || iv.addressLine) && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--color-body)]">
          <MapPin
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-muted)]"
            aria-hidden
          />
          <span>
            {iv.venueName}
            {iv.addressLine && ` · ${iv.addressLine}`}
            {iv.roomOrFloor && ` · ${iv.roomOrFloor}`}
          </span>
        </p>
      )}

      {/* Legacy locationOrLink fallback */}
      {!iv.venueName && iv.locationOrLink && (
        <p className="mt-2 break-all text-xs text-[var(--color-body)]">
          {iv.locationOrLink}
        </p>
      )}

      {/* ── Interviewer ────────────────────────────────────────────────── */}
      {iv.interviewerName && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
          <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {iv.interviewerName}
            {iv.interviewerTitle && `, ${iv.interviewerTitle}`}
          </span>
        </p>
      )}

      {/* ── Live elapsed badge (only when in_progress) ─────────────────── */}
      {isInProgress && (
        <ElapsedBadge
          scheduledAt={iv.scheduledAt}
          durationMinutes={iv.durationMinutes}
        />
      )}

      {/* ── Actions ────────────────────────────────────────────────────── */}
      {showActions && !isReadOnly && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--color-hairline)] pt-3">
          {isScheduled && (
            <>
              <button
                type="button"
                onClick={() => setRescheduleOpen(true)}
                disabled={isPending}
                className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-xs font-medium text-[var(--color-body)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)] disabled:opacity-60"
              >
                Reschedule
              </button>
              <button
                type="button"
                onClick={patchNoShow}
                disabled={isPending}
                className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-xs font-medium text-[var(--color-body)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)] disabled:opacity-60"
              >
                {pending === "no-show" ? <ButtonSpinner /> : null}
                Mark No-Show
              </button>
              <button
                type="button"
                onClick={patchCancel}
                disabled={isPending}
                className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-status-danger)] bg-[var(--color-canvas)] px-3 text-xs font-medium text-[var(--color-status-danger)] transition hover:bg-[var(--color-status-danger)] hover:text-[var(--color-on-primary)] disabled:opacity-60"
              >
                {pending === "cancel" ? <ButtonSpinner /> : null}
                Cancel
              </button>
            </>
          )}

          {/* Per thesis panel revision (May 2026): while in_progress the
              recruiter can mark complete early and unlock candidate
              identity + resume download immediately. */}
          {isInProgress && (
            <>
              <button
                type="button"
                onClick={patchComplete}
                disabled={isPending}
                className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-status-success)] px-3 text-xs font-semibold text-[var(--color-on-primary)] transition hover:opacity-90 disabled:opacity-60"
              >
                {pending === "complete" ? <ButtonSpinner /> : null}
                Mark as Completed
              </button>
              <button
                type="button"
                onClick={patchNoShow}
                disabled={isPending}
                className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-xs font-medium text-[var(--color-body)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)] disabled:opacity-60"
              >
                {pending === "no-show" ? <ButtonSpinner /> : null}
                Mark No-Show
              </button>
              <button
                type="button"
                onClick={patchCancel}
                disabled={isPending}
                className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-status-danger)] bg-[var(--color-canvas)] px-3 text-xs font-medium text-[var(--color-status-danger)] transition hover:bg-[var(--color-status-danger)] hover:text-[var(--color-on-primary)] disabled:opacity-60"
              >
                {pending === "cancel" ? <ButtonSpinner /> : null}
                Cancel
              </button>
            </>
          )}

          {isCompleted && (
            <Link
              href={`/recruiter/interviews/${iv.id}`}
              className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-3 text-xs font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
            >
              View / Add Feedback
            </Link>
          )}
        </div>
      )}

      {/* ── Reschedule modal ──────────────────────────────────────────────── */}
      {showActions && isScheduled && (
        <RescheduleModalClient
          interviewId={iv.id}
          applicationId={applicationId}
          defaults={{
            scheduledAt: iv.scheduledAt,
            durationMinutes: iv.durationMinutes,
            venueName: iv.venueName ?? undefined,
            addressLine: iv.addressLine ?? undefined,
            roomOrFloor: iv.roomOrFloor,
            interviewerName: iv.interviewerName,
            interviewerTitle: iv.interviewerTitle,
          }}
          open={rescheduleOpen}
          onOpenChange={setRescheduleOpen}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main exported section
// ---------------------------------------------------------------------------

interface Props {
  applicationId: string;
  interviews: InterviewRow[];
  applicationStatus: string;
}

export function RecruiterInterviewsSection({
  applicationId,
  interviews,
  applicationStatus,
}: Props) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);

  // Per thesis panel revision (May 2026): "screening" stage removed.
  const canScheduleAnother =
    applicationStatus === "interview" || applicationStatus === "applied";

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Auto-open the schedule modal when arriving with ?schedule=1, set by the
  // decision bar after a status flip to "interview" or by the prompt banner.
  // We scrub the param either way so refresh/back doesn't re-trigger. This is
  // a URL→state sync (URL is an external system); the lint rule against
  // setState-in-effect doesn't fit this case.
  useEffect(() => {
    if (searchParams.get("schedule") !== "1") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (interviews.length === 0) setScheduleOpen(true);
    router.replace(pathname);
  }, [searchParams, pathname, interviews.length, router]);

  const sorted = sortInterviews(interviews);
  const [active, ...past] = sorted;

  const latestStatus = active?.status ?? null;
  const hasPast = past.length > 0;
  const isEmpty = interviews.length === 0;

  return (
    <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      {/* ── Section header ─────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Interview
          </h2>
          {latestStatus && <StatusPill status={latestStatus} />}
        </div>
        {canScheduleAnother && (
          <Button
            onClick={() => setScheduleOpen(true)}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
          >
            {isEmpty ? "Schedule interview" : "Schedule another interview"}
          </Button>
        )}
      </header>

      {/* ── No interviews state ────────────────────────────────────────── */}
      {isEmpty && (
        <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-4 py-5 text-sm">
          <CalendarClock
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-muted)]"
            aria-hidden
          />
          <div>
            <p className="font-medium text-[var(--color-ink)]">
              No interviews scheduled yet
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Set a date, format, and venue, the candidate gets a calendar
              invite and reporting details by email.
            </p>
          </div>
        </div>
      )}

      {/* ── Active interview card ─────────────────────────────────────── */}
      {active && (
        <InterviewCard
          interview={active}
          applicationId={applicationId}
          showActions
        />
      )}

      {/* ── Past interviews accordion ─────────────────────────────────── */}
      {hasPast && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setPastOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${pastOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
            {pastOpen ? "Hide" : "Show"} past interviews ({past.length})
          </button>

          {pastOpen && (
            <ul className="space-y-2">
              {past.map((iv) => (
                <li key={iv.id}>
                  <InterviewCard
                    interview={iv}
                    applicationId={applicationId}
                    showActions={false}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Schedule interview sheet ──────────────────────────────────── */}
      <ScheduleInterviewSheetClient
        applicationId={applicationId}
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// ElapsedBadge — ticking live timer while the interview is in_progress.
// ---------------------------------------------------------------------------

/**
 * Per thesis panel revision (May 2026): while an interview is in the
 * in_progress phase, recruiters see a live "00:23 elapsed of 60:00"
 * readout that ticks every second. The render is cheap (one
 * setInterval, single useState) and the badge gracefully clamps to
 * the duration max — if the cron is late to flip to completed, the
 * UI shows "60:00 elapsed (overrun)" rather than counting forever.
 */
function ElapsedBadge({
  scheduledAt,
  durationMinutes,
}: {
  scheduledAt: string;
  durationMinutes: number;
}) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const startMs = new Date(scheduledAt).getTime();
  const elapsedSec = Math.max(0, Math.floor((now - startMs) / 1000));
  const durationSec = durationMinutes * 60;
  const isOverrun = elapsedSec >= durationSec;
  const displaySec = isOverrun ? durationSec : elapsedSec;

  function fmt(totalSec: number): string {
    const m = Math.floor(totalSec / 60)
      .toString()
      .padStart(2, "0");
    const s = (totalSec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  return (
    <div className="mt-2 flex items-center gap-2 text-xs">
      <span
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary-soft)] px-2.5 py-1 font-mono font-semibold text-[var(--color-primary)]"
        aria-live="polite"
      >
        <span
          className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)] animate-pulse"
          aria-hidden
        />
        {fmt(displaySec)} elapsed of {fmt(durationSec)}
      </span>
      {isOverrun && (
        <span className="text-[11px] text-[var(--color-muted)]">
          past scheduled end — auto-completes any moment
        </span>
      )}
    </div>
  );
}
