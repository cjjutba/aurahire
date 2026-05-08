"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { getActiveCompanyId } from "@/lib/active-company";
import { ShareFeedbackModalClient } from "@/components/interview/share-feedback-modal-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InterviewForFeedback {
  id: string;
  feedback: string | null;
  rating: number | null;
  recommendation: "proceed" | "hold" | "reject" | null;
  candidateSummary: string | null;
  sharedWithCandidateAt: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
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
// StarRating
// ---------------------------------------------------------------------------

function StarRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = (hovered ?? value ?? 0) >= star;
        return (
          <button
            key={star}
            type="button"
            aria-label={`${star} star${star !== 1 ? "s" : ""}`}
            onClick={() => onChange(value === star ? null : star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            className="rounded p-0.5 transition focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          >
            <Star
              className={`h-5 w-5 transition ${
                filled
                  ? "fill-[var(--color-score-mid)] stroke-[var(--color-score-mid)]"
                  : "fill-transparent stroke-[var(--color-hairline)]"
              }`}
              aria-hidden
            />
          </button>
        );
      })}
      {value !== null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-1 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          Clear
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recommendation options
// ---------------------------------------------------------------------------

type Recommendation = "proceed" | "hold" | "reject";

const RECOMMENDATION_OPTIONS: Array<{
  value: Recommendation;
  label: string;
  description: string;
}> = [
  {
    value: "proceed",
    label: "Proceed → Offer",
    description: "Recommend sending an offer to this candidate.",
  },
  {
    value: "hold",
    label: "Hold",
    description: "Keep the candidate in consideration for now.",
  },
  {
    value: "reject",
    label: "Reject",
    description: "Not a fit at this time.",
  },
];

// ---------------------------------------------------------------------------
// FeedbackPanelClient
// ---------------------------------------------------------------------------

interface Props {
  interview: InterviewForFeedback;
}

export function FeedbackPanelClient({ interview }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const [feedbackText, setFeedbackText] = useState<string>(
    interview.feedback ?? "",
  );
  const [rating, setRating] = useState<number | null>(interview.rating ?? null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(
    interview.recommendation ?? null,
  );

  async function saveFeedback() {
    setSaving(true);
    try {
      const res = await authedFetch(
        `/api/v1/interviews/${interview.id}/feedback`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            feedback: feedbackText,
            rating,
            recommendation,
          }),
        },
      );
      if (!res.ok) {
        toastApiError(null, "Couldn't save feedback", "Please try again.");
        return;
      }
      toastSuccess("Feedback saved");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const sharedDate = interview.sharedWithCandidateAt
    ? new Date(interview.sharedWithCandidateAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <section className="space-y-5 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Interview Feedback
        </h2>
        {sharedDate && (
          <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-score-high-soft)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-score-high)]">
            Shared with candidate {sharedDate}
          </span>
        )}
      </div>

      {/* ── Private feedback section ──────────────────────────────────── */}
      <div>
        <label
          htmlFor="fp-feedback"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]"
        >
          Private feedback
        </label>
        <textarea
          id="fp-feedback"
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          maxLength={5000}
          rows={6}
          placeholder="Your private notes about this interview. Visible to recruiters only."
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)]"
        />
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">
          {feedbackText.length}/5000
        </p>
      </div>

      {/* ── Rating ────────────────────────────────────────────────────── */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Rating
        </p>
        <StarRating value={rating} onChange={setRating} />
      </div>

      {/* ── Recommendation ────────────────────────────────────────────── */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Recommendation
        </p>
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Recommendation"
        >
          {RECOMMENDATION_OPTIONS.map((opt) => {
            const isSelected = recommendation === opt.value;
            const ringColor =
              opt.value === "proceed"
                ? "ring-[var(--color-score-high)]"
                : opt.value === "reject"
                  ? "ring-[var(--color-score-low)]"
                  : "ring-[var(--color-score-mid)]";
            const selectedBg =
              opt.value === "proceed"
                ? "bg-[var(--color-score-high-soft)] text-[var(--color-score-high)]"
                : opt.value === "reject"
                  ? "bg-[var(--color-score-low-soft)] text-[var(--color-score-low)]"
                  : "bg-[var(--color-score-mid-soft)] text-[var(--color-score-mid)]";
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() =>
                  setRecommendation(isSelected ? null : opt.value)
                }
                title={opt.description}
                className={`inline-flex h-8 items-center rounded-[var(--radius-pill)] border px-3 text-xs font-semibold transition ${
                  isSelected
                    ? `border-transparent ${selectedBg} ring-2 ring-offset-1 ${ringColor}`
                    : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-body)] hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Candidate-facing summary ──────────────────────────────────── */}
      {interview.candidateSummary && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Candidate-facing summary
          </p>
          <p className="whitespace-pre-wrap text-sm text-[var(--color-body)]">
            {interview.candidateSummary}
          </p>
          {sharedDate && (
            <p className="mt-2 text-[11px] text-[var(--color-muted)]">
              Shared {sharedDate}
            </p>
          )}
        </div>
      )}

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-hairline)] pt-4">
        <Button
          onClick={saveFeedback}
          disabled={saving}
          className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          {saving && <ButtonSpinner />}
          {saving ? "Saving…" : "Save Feedback"}
        </Button>

        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="inline-flex h-8 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-xs font-medium text-[var(--color-body)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]"
        >
          Share with candidate
        </button>
      </div>

      {/* ── Share modal ──────────────────────────────────────────────── */}
      <ShareFeedbackModalClient
        open={shareOpen}
        onOpenChange={setShareOpen}
        interviewId={interview.id}
        defaultSummary={feedbackText}
        currentSummary={interview.candidateSummary}
        onShared={() => router.refresh()}
      />
    </section>
  );
}
