"use client";

import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { toastSuccess, toastApiError } from "@/lib/toast";
import { AiShimmer } from "@/components/ai/ai-shimmer";
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

export function ProfileScoreCardClient({ candidateId }: ProfileScoreCardClientProps) {
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

  const recompute = useMutation({
    mutationFn: () =>
      clientApiFetch<{ data: ProfileScore }>("/api/v1/scoring/profile/compute", {
        method: "POST",
      }),
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

  // 1. No score yet — server-side guard has already enqueued a backfill (or
  //    onboarding is finishing). Show the shimmer with a caption explaining
  //    what AI is doing. No manual button — the score will arrive over
  //    realtime.
  if (!score) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Profile Score
        </h3>
        <div className="mt-4">
          <AiShimmer caption="Computing your Profile Score…" height={120} />
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
