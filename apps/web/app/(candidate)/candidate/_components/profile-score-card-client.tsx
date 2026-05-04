"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toastSuccess, toastApiError } from "@/lib/toast";

import { AiShimmer } from "@/components/ai/ai-shimmer";
import { ScoreRing } from "@/components/score/score-ring";
import { MatchBandChip } from "@/components/score/match-band-chip";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

interface InitialScore {
  id: string;
  overallScore: number;
  band: "strong" | "partial" | "limited";
  createdAt: string;
}

interface Props {
  initial: InitialScore | null;
}

export function ProfileScoreCardClient({ initial }: Props) {
  const router = useRouter();
  const [score, setScore] = useState<InitialScore | null>(initial);
  const [computing, setComputing] = useState(false);

  async function compute() {
    setComputing(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toastApiError(null, "Couldn't recalculate", "Please sign in again.");
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const res = await fetch(`${apiUrl}/api/v1/scoring/profile/compute`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.status === 429) {
        toastApiError(null, "Couldn't recalculate", "Please wait a moment before recalculating.");
        return;
      }

      if (res.status === 400) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        toastApiError(null, "Couldn't recalculate", body.message ?? "Complete your profile before recalculating.");
        return;
      }

      if (!res.ok) {
        toastApiError(null, "Couldn't recalculate");
        return;
      }

      const body = (await res.json()) as { data: InitialScore };
      setScore(body.data);
      toastSuccess("Score recalculated");
      router.refresh();
    } catch (err) {
      toastApiError(err, "Couldn't recalculate");
    } finally {
      setComputing(false);
    }
  }

  if (computing) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Profile Score
        </h3>
        <div className="mt-4">
          <AiShimmer caption="Computing your Profile Score..." height={120} />
        </div>
      </div>
    );
  }

  if (!score) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Profile Score
        </h3>
        <p className="mt-3 text-sm text-[var(--color-body)]">
          Compute your AI-powered profile score to see how strong your resume looks.
        </p>
        <Button
          onClick={compute}
          className="mt-4 rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          Compute my score
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        Profile Score
      </h3>
      <div className="mt-4 flex items-center gap-4">
        <ScoreRing score={score.overallScore} band={score.band} size="sm" />
        <div className="space-y-2">
          <MatchBandChip band={score.band} />
          <p className="text-xs text-[var(--color-muted)]">
            {formatTimeAgo(score.createdAt)}
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
        <button
          type="button"
          onClick={compute}
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          Recompute
        </button>
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
