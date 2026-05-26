"use client";

/**
 * Apply CTA for the candidate job-detail page. Per thesis panel revision
 * (May 2026), candidates whose preview match score is below the
 * auto-reject threshold cannot proceed to the apply form. This component
 * renders the Apply button or its disabled equivalent based on the same
 * preview query the MatchPreviewClient consumes — so both surfaces stay
 * in sync without a prop-drilling refactor.
 *
 * Three render paths:
 *
 *   - `hasApplied`: candidate already applied — render "View your
 *     application" (passed-through behaviour from the prior server
 *     render).
 *   - Preview loaded AND below threshold: disabled pill with a tooltip
 *     and a "below threshold" inline caption pointing to the job
 *     detail's match-preview card.
 *   - Otherwise (preview loading, missing, or at-or-above threshold):
 *     normal Apply CTA pill.
 */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Check, ShieldX, Sparkles } from "lucide-react";
import { AUTO_REJECT_THRESHOLD } from "@aurahire/shared";

import { clientApiFetch } from "@/hooks/_client-fetch";

interface MatchPreviewEnvelope {
  data: {
    overallScore: number;
    band: "strong" | "partial" | "limited";
  } | null;
}

interface ApplyCtaClientProps {
  jobId: string;
  hasApplied: boolean;
  applyHref: string;
  viewApplicationHref: string;
  /** Visual variant — affects sizing, not behaviour. */
  variant: "card" | "sticky";
}

export function ApplyCtaClient({
  jobId,
  hasApplied,
  applyHref,
  viewApplicationHref,
  variant,
}: ApplyCtaClientProps) {
  // Same query key as MatchPreviewClient — TanStack reuses the cached
  // result, no duplicate request.
  const previewQuery = useQuery<MatchPreviewEnvelope>({
    queryKey: ["candidate-match-preview", jobId] as const,
    queryFn: ({ signal }) =>
      clientApiFetch<MatchPreviewEnvelope>(
        `/api/v1/scoring/match-preview/${jobId}`,
        { signal },
      ),
    enabled: !hasApplied,
    staleTime: 60_000,
  });
  const preview = previewQuery.data?.data ?? null;
  const belowThreshold =
    preview !== null && preview.overallScore < AUTO_REJECT_THRESHOLD;

  if (hasApplied) {
    return (
      <Link
        href={viewApplicationHref}
        className={
          variant === "card"
            ? "mt-3 inline-flex h-11 w-full items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-soft)]"
            : "inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-6 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-surface-soft)]"
        }
      >
        {variant === "sticky" && (
          <Check className="h-4 w-4 text-[var(--color-status-success)]" />
        )}
        {variant === "card" ? "View your application" : "View your application"}
      </Link>
    );
  }

  if (belowThreshold) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={`Match score below ${AUTO_REJECT_THRESHOLD} — apply is blocked for this role`}
          className={
            variant === "card"
              ? "inline-flex h-12 w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary-disabled)] px-6 text-sm font-semibold text-[var(--color-on-primary)] opacity-90"
              : "inline-flex h-12 w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary-disabled)] px-6 text-sm font-semibold text-[var(--color-on-primary)] opacity-90"
          }
        >
          <ShieldX className="h-4 w-4" />
          Below {AUTO_REJECT_THRESHOLD} match — can&apos;t apply
        </button>
        {variant === "card" && (
          <p className="text-center text-xs text-[var(--color-muted)]">
            Match{" "}
            <span className="font-mono">{preview!.overallScore}</span> / 100,
            below the {AUTO_REJECT_THRESHOLD} minimum.
          </p>
        )}
      </div>
    );
  }

  // Default — preview loading, no preview yet, or score at/above threshold.
  return (
    <Link
      href={applyHref}
      className={
        variant === "card"
          ? "inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
          : "inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
      }
    >
      <Sparkles className="h-4 w-4" />
      Apply Now
    </Link>
  );
}
