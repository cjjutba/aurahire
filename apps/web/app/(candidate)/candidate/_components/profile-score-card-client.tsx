"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { toastSuccess, toastApiError } from "@/lib/toast";
import {
  AiProgressIndicator,
  PROFILE_SCORE_STAGES,
} from "@/components/ai/ai-progress-indicator";
import { ScoreRing } from "@/components/score/score-ring";
import { MatchBandChip } from "@/components/score/match-band-chip";
import { useProfileScoreQuery } from "@/hooks/use-profile-score";
import { ClientApiError, clientApiFetch } from "@/hooks/_client-fetch";
import { queryKeys } from "@/lib/query";
import { useCandidateRealtime } from "@/lib/realtime/use-candidate-realtime";

interface ProfileScore {
  id: string;
  overallScore: number;
  band: "strong" | "partial" | "limited";
  createdAt: string;
}

interface ProfileScoreCardClientProps {
  /**
   * The candidate's id, used to filter realtime profile-score.updated events.
   * Pass `null` while the parent is still hydrating session — the hook becomes
   * a no-op until a real id appears.
   */
  candidateId: string | null;
}

export function ProfileScoreCardClient({
  candidateId,
}: ProfileScoreCardClientProps) {
  const qc = useQueryClient();
  const query = useProfileScoreQuery();
  const score = (query.data as { data?: ProfileScore })?.data ?? null;

  const { latestProfileScore } = useCandidateRealtime(candidateId);

  // Realtime: invalidate the profile-score query whenever a fresh
  // profile-score.updated event arrives for this candidate. The hook already
  // filters by candidateId so any payload we see here is ours.
  useEffect(() => {
    if (!latestProfileScore) return;
    void qc.invalidateQueries({ queryKey: queryKeys.profileScore.me() });
  }, [latestProfileScore, qc]);

  // 30s timeout: if the score is still null this many ms after the card
  // mounts, surface a calm error state with a manual retry. Realtime
  // arrivals cancel the timer naturally because `score` becomes truthy.
  const PROFILE_SCORE_PENDING_TIMEOUT_MS = 30_000;
  const [pendingTimedOut, setPendingTimedOut] = useState(false);

  useEffect(() => {
    if (score) {
      // Score has landed — reset the timeout so a future stale-and-recompute
      // cycle gets its own fresh 30s window.
      if (pendingTimedOut) setPendingTimedOut(false);
      return;
    }
    // Already timed out: don't spawn a second timer when the effect re-runs
    // because `pendingTimedOut` is in the deps. The next `score` arrival will
    // flip pendingTimedOut back to false and re-arm naturally.
    if (pendingTimedOut) return;
    const t = setTimeout(
      () => setPendingTimedOut(true),
      PROFILE_SCORE_PENDING_TIMEOUT_MS,
    );
    return () => clearTimeout(t);
  }, [score, pendingTimedOut]);

  const recompute = useMutation({
    mutationFn: () =>
      clientApiFetch<{ data: ProfileScore }>(
        "/api/v1/scoring/profile/compute",
        {
          method: "POST",
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.profileScore.me() });
      toastSuccess("Score recalculated");
    },
    onError: (err) => {
      if (err instanceof ClientApiError) {
        const body = err.body as { message?: string } | null;
        if (err.status === 429) {
          toastApiError(
            null,
            "Couldn't recalculate",
            "Please wait a moment before recalculating.",
          );
          return;
        }
        if (err.status === 400) {
          toastApiError(
            null,
            "Couldn't recalculate",
            body?.message ?? "Complete your profile before recalculating.",
          );
          return;
        }
      }
      toastApiError(err, "Couldn't recalculate");
    },
  });

  const isRecomputing = recompute.isPending;

  // 1. No score yet — shimmer for the first PROFILE_SCORE_PENDING_TIMEOUT_MS,
  //    then transition to a calm error card with manual retry. The backend
  //    has already enqueued a recompute on the degraded path; this UI only
  //    surfaces the failure if the recompute also doesn't land in time.
  if (!score) {
    if (pendingTimedOut) {
      return (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Profile Score
          </h3>
          <div className="mt-4 space-y-3">
            <p className="text-sm text-[var(--color-ink)]">
              We couldn&rsquo;t compute your score yet.
            </p>
            <p className="text-xs text-[var(--color-muted)]">
              This usually self-resolves within a minute. You can also try again
              now.
            </p>
            <button
              type="button"
              onClick={() => recompute.mutate()}
              disabled={isRecomputing}
              className="inline-flex h-9 items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)] disabled:opacity-60"
            >
              {isRecomputing ? "Trying…" : "Try again"}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Profile Score
        </h3>
        <div className="mt-4">
          <AiProgressIndicator stages={PROFILE_SCORE_STAGES} />
        </div>
      </div>
    );
  }

  // 2. Score exists — render it. If a recompute is in flight, overlay shimmer
  //    on top of the existing number so the candidate keeps context while
  //    the new value lands.
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        Profile Score
      </h3>
      <div className="mt-4 flex items-center gap-4">
        <div className="relative">
          <ScoreRing score={score.overallScore} band={score.band} size="sm" />
          {isRecomputing && (
            <div
              className="absolute inset-0 flex items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-canvas)]/70 backdrop-blur-[1px]"
              aria-busy="true"
              aria-label="Recomputing profile score"
            >
              <div className="h-full w-full animate-shimmer rounded-[var(--radius-full)] bg-gradient-to-r from-[var(--color-surface-strong)] via-[var(--color-surface-soft)] to-[var(--color-surface-strong)] opacity-80" />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <MatchBandChip band={score.band} />
          <p className="text-xs text-[var(--color-muted)]">
            {isRecomputing ? "Recomputing…" : formatTimeAgo(score.createdAt)}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <Link
          href="/candidate/profile"
          className="text-[var(--color-primary)] hover:underline"
        >
          View breakdown →
        </Link>
        {!isRecomputing && (
          <button
            type="button"
            onClick={() => recompute.mutate()}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            Recompute
          </button>
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
