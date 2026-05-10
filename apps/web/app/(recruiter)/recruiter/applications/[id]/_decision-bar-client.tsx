"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, X } from "lucide-react";

import { ButtonSpinner } from "@/components/ui/button-spinner";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { getActiveCompanyId } from "@/lib/active-company";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { useConfirm } from "@/components/providers/confirm-provider";

import { ShortlistButtonClient } from "./_shortlist-button-client";
import { OfferConfirmModalClient } from "./_offer-confirm-modal-client";

const PIPELINE_STAGES: Array<{ key: string; label: string }> = [
  { key: "applied", label: "Applied" },
  { key: "screening", label: "Screening" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "offer_declined", label: "Offer Declined" },
  { key: "hired", label: "Hired" },
];

interface AdvanceAction {
  status: string;
  label: string;
  /** When set, the CTA navigates to this href instead of PATCHing /status. */
  href?: (applicationId: string) => string;
}

const NEXT_POSITIVE: Record<string, AdvanceAction[] | null> = {
  applied: [
    { status: "screening", label: "Move to Screening" },
    { status: "interview", label: "Move to Interview" },
  ],
  screening: [{ status: "interview", label: "Move to Interview" }],
  interview: [
    {
      status: "offer",
      label: "Send Offer",
      href: (id) => `/recruiter/offers/new?applicationId=${id}`,
    },
  ],
  offer: [{ status: "hired", label: "Mark Hired" }],
  hired: null,
  rejected: null,
  withdrawn: null,
};

const TERMINAL_STATUSES = new Set(["hired", "rejected", "withdrawn"]);

interface DecisionBarProps {
  applicationId: string;
  currentStatus: string;
  shortlistedAt: string | null;
  /**
   * Recommendation from the most recent completed interview.
   * Wired by the parent once interview data is available (Task 34).
   * Drives highlight rings on advance / reject CTAs.
   */
  latestInterviewRecommendation?: "proceed" | "hold" | "reject" | null;
}

type PendingAction = "download" | `advance-${number}` | "reject";

export function DecisionBarClient({
  applicationId,
  currentStatus,
  shortlistedAt,
  latestInterviewRecommendation,
}: DecisionBarProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const isPending = pending !== null;

  // Soft-confirm modal state (Task 35)
  const [softConfirmOpen, setSoftConfirmOpen] = useState(false);
  const [softConfirmAction, setSoftConfirmAction] = useState<"offer" | "reject">("offer");
  // Deferred callback to execute after soft-confirm is accepted
  const [softConfirmCallback, setSoftConfirmCallback] = useState<(() => void) | null>(null);

  /**
   * Returns true when the soft-confirm gate should fire:
   * - status is "interview"
   * - no feedback recorded (recommendation is null)
   * - session has not already been warned
   */
  function needsSoftConfirm(): boolean {
    if (currentStatus !== "interview") return false;
    if (latestInterviewRecommendation !== null && latestInterviewRecommendation !== undefined) return false;
    const warnKey = `interview-feedback-warn:${applicationId}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(warnKey)) return false;
    return true;
  }

  function openSoftConfirm(action: "offer" | "reject", callback: () => void) {
    setSoftConfirmAction(action);
    setSoftConfirmCallback(() => callback);
    setSoftConfirmOpen(true);
  }

  function handleSoftConfirm() {
    const warnKey = `interview-feedback-warn:${applicationId}`;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(warnKey, "1");
    }
    softConfirmCallback?.();
  }

  const nextActions = NEXT_POSITIVE[currentStatus] ?? null;
  const isTerminal = TERMINAL_STATUSES.has(currentStatus);

  async function authedFetch(
    path: string,
    init: RequestInit,
  ): Promise<Response> {
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
  }

  async function changeStatus(
    newStatus: string,
    mode: PendingAction,
  ) {
    setPending(mode);
    try {
      const res = await authedFetch(
        `/api/v1/applications/${applicationId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newStatus }),
        },
      );
      if (!res.ok) {
        toastApiError(null, "Couldn't update status", "Please try again.");
        return;
      }
      toastSuccess("Status updated");
      // When advancing to "interview" we hand off to the Interviews section,
      // which auto-opens the schedule modal on `?schedule=1`. The query param
      // survives router.refresh() so the modal pops without lifting state.
      if (newStatus === "interview") {
        router.replace(
          `/recruiter/applications/${applicationId}?schedule=1`,
        );
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function downloadResume() {
    setPending("download");
    try {
      const res = await authedFetch(
        `/api/v1/applications/${applicationId}/resume-download`,
        { method: "GET" },
      );
      if (!res.ok) {
        toastApiError(null, "Couldn't download", "Please try again.");
        return;
      }
      const body = (await res.json()) as { data: { signedUrl: string } };
      window.open(body.data.signedUrl, "_blank");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="sticky top-0 z-30 -mx-4 border-y border-[var(--color-hairline)] bg-[var(--color-canvas)]/95 px-4 py-3 backdrop-blur-sm md:-mx-6 md:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <PipelinePath currentStatus={currentStatus} />

        <div className="flex flex-wrap items-center gap-2">
          <ShortlistButtonClient
            applicationId={applicationId}
            initialShortlistedAt={shortlistedAt}
          />

          <button
            type="button"
            onClick={downloadResume}
            disabled={isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-sm font-medium text-[var(--color-body)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)] disabled:opacity-60"
          >
            {pending === "download" ? (
              <ButtonSpinner />
            ) : (
              <Download className="h-4 w-4" aria-hidden />
            )}
            <span>Resume</span>
          </button>

          {nextActions?.map((action, idx) => {
            const actionKey = `advance-${idx}` as const;
            const isSendOffer = action.label === "Send Offer";
            const showOfferRing =
              isSendOffer && latestInterviewRecommendation === "proceed";

            if (action.href) {
              const targetHref = action.href(applicationId);
              const proceedOffer = () => router.push(targetHref);
              return (
                <button
                  key={action.status}
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    if (isSendOffer && needsSoftConfirm()) {
                      openSoftConfirm("offer", proceedOffer);
                    } else {
                      proceedOffer();
                    }
                  }}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)] disabled:opacity-60${showOfferRing ? " ring-2 ring-offset-1 ring-[var(--color-score-high)]" : ""}`}
                >
                  <Check className="h-4 w-4" aria-hidden />
                  <span>{action.label}</span>
                </button>
              );
            }

            return (
              <button
                key={action.status}
                type="button"
                onClick={async () => {
                  const proceed = async () => {
                    const ok = await confirm({
                      title: `${action.label}?`,
                      description:
                        "Confirm this status change. The candidate will be notified by email.",
                      confirmLabel: action.label,
                      variant: "info",
                    });
                    if (!ok) return;
                    await changeStatus(action.status, actionKey);
                  };
                  await proceed();
                }}
                disabled={isPending}
                className={`inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)] disabled:opacity-60${showOfferRing ? " ring-2 ring-offset-1 ring-[var(--color-score-high)]" : ""}`}
              >
                {pending === actionKey ? (
                  <ButtonSpinner />
                ) : (
                  <Check className="h-4 w-4" aria-hidden />
                )}
                <span>{action.label}</span>
              </button>
            );
          })}

          {!isTerminal && (
            <button
              type="button"
              onClick={async () => {
                const doReject = async () => {
                  const ok = await confirm({
                    title: "Reject this application?",
                    description:
                      "The candidate will be marked as rejected. You can change this later if needed.",
                    confirmLabel: "Reject candidate",
                    variant: "destructive",
                  });
                  if (!ok) return;
                  await changeStatus("rejected", "reject");
                };
                if (needsSoftConfirm()) {
                  openSoftConfirm("reject", () => { void doReject(); });
                } else {
                  await doReject();
                }
              }}
              disabled={isPending}
              className={`inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-status-danger)] bg-[var(--color-canvas)] px-3 text-sm font-medium text-[var(--color-status-danger)] transition hover:bg-[var(--color-status-danger)] hover:text-[var(--color-on-primary)] disabled:opacity-60${latestInterviewRecommendation === "reject" ? " ring-2 ring-offset-1 ring-[var(--color-status-danger)]" : ""}`}
            >
              {pending === "reject" ? (
                <ButtonSpinner />
              ) : (
                <X className="h-4 w-4" aria-hidden />
              )}
              <span>Reject</span>
            </button>
          )}
        </div>
      </div>

      {/* Soft-confirm modal — shown when recruiter acts without interview feedback */}
      <OfferConfirmModalClient
        open={softConfirmOpen}
        onOpenChange={setSoftConfirmOpen}
        action={softConfirmAction}
        onConfirm={handleSoftConfirm}
      />
    </div>
  );
}

function PipelinePath({ currentStatus }: { currentStatus: string }) {
  // Off-pipeline terminal states get a dedicated chip instead of the funnel.
  if (currentStatus === "rejected" || currentStatus === "withdrawn") {
    const isRejected = currentStatus === "rejected";
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Pipeline
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
            isRejected
              ? "bg-[var(--color-score-low-soft)] text-[var(--color-score-low)]"
              : "bg-[var(--color-surface-strong)] text-[var(--color-muted)]"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isRejected
                ? "bg-[var(--color-score-low)]"
                : "bg-[var(--color-muted)]"
            }`}
            aria-hidden
          />
          {isRejected ? "Rejected" : "Withdrawn"}
        </span>
      </div>
    );
  }

  const currentIdx = PIPELINE_STAGES.findIndex((s) => s.key === currentStatus);
  const safeIdx = currentIdx === -1 ? 0 : currentIdx;

  return (
    <ol
      aria-label="Pipeline stage"
      className="flex flex-wrap items-center gap-x-1 gap-y-1.5 text-xs"
    >
      {PIPELINE_STAGES.map((stage, idx) => {
        const isCurrent = idx === safeIdx;
        const isPast = idx < safeIdx;
        return (
          <li key={stage.key} className="flex items-center gap-1.5">
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={`flex h-2 w-2 items-center justify-center rounded-full transition ${
                isCurrent
                  ? "bg-[var(--color-primary)] ring-2 ring-[var(--color-primary-soft)]"
                  : isPast
                    ? "bg-[var(--color-primary)]"
                    : "border border-[var(--color-hairline)] bg-[var(--color-canvas)]"
              }`}
            />
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                isCurrent
                  ? "text-[var(--color-primary)]"
                  : isPast
                    ? "text-[var(--color-ink)]"
                    : "text-[var(--color-muted)]"
              }`}
            >
              {stage.label}
            </span>
            {idx < PIPELINE_STAGES.length - 1 && (
              <span
                aria-hidden
                className={`mx-1 hidden h-px w-5 sm:inline-block ${
                  isPast || isCurrent
                    ? "bg-[var(--color-hairline)]"
                    : "bg-[var(--color-hairline-soft)]"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
