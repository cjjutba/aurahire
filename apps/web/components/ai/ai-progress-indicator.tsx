"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

export interface ProgressStage {
  id: string;
  /** Human-readable label shown while this stage is active. */
  label: string;
  /** Cumulative percent (0-100) at which this stage ends. */
  percentTarget: number;
  /** Typical duration of this stage in ms, used for synthetic pacing. */
  durationMs: number;
}

interface AiProgressIndicatorProps {
  stages: ProgressStage[];
  /** Flip true when the underlying async work has resolved; the bar snaps to 100%. */
  done?: boolean;
  /** Optional fallback caption shown if `stages` is empty (degenerate case). */
  fallbackCaption?: string;
  className?: string;
}

/**
 * AuraHire's unified "AI is working" affordance, a staged progress bar with
 * a real-time percentage and a stage-specific caption that names what the AI
 * is doing right now ("Securing your information" / "Analyzing your profile" /
 * "Finalizing your score"). Designed to replace the old silent shimmer on every
 * AI compute path so users always see meaningful progress.
 *
 * Pacing is synthetic but stage-accurate: each stage advances asymptotically
 * toward its `percentTarget` over its `durationMs`, so the bar feels alive
 * even when the AI takes longer than the typical case. When the caller's API
 * call resolves, set `done` and the bar snaps to 100%.
 */
export function AiProgressIndicator({
  stages,
  done = false,
  fallbackCaption = "AI is working…",
  className,
}: AiProgressIndicatorProps) {
  const [percent, setPercent] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const startedRef = useRef<number>(0);

  useEffect(() => {
    if (done) {
      setPercent(100);
      return;
    }

    if (stages.length === 0) return;

    startedRef.current = performance.now();

    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - startedRef.current;

      // Locate the active stage by walking the cumulative duration timeline.
      let acc = 0;
      let active = stages.length - 1;
      for (let i = 0; i < stages.length; i++) {
        if (elapsed < acc + stages[i]!.durationMs) {
          active = i;
          break;
        }
        acc += stages[i]!.durationMs;
      }

      const stage = stages[active]!;
      const startPct = active === 0 ? 0 : stages[active - 1]!.percentTarget;
      const endPct = stage.percentTarget;
      const stageElapsed = Math.max(0, elapsed - acc);
      const stageDur = Math.max(1, stage.durationMs);
      // Asymptotic ease-out: rapid early progress, decelerates near the cap so
      // we never quite hit it until the next stage begins (or `done` snaps).
      const ratio = 1 - Math.exp(-stageElapsed / (stageDur * 0.5));
      const capped = Math.min(ratio, 0.98);
      const next = startPct + (endPct - startPct) * capped;

      setPercent(next);
      setStageIdx(active);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [done, stages]);

  const displayPct = Math.round(Math.min(percent, 100));
  const stage = stages[stageIdx];
  const label = done ? "Done" : (stage?.label ?? fallbackCaption);

  return (
    <div
      className={`space-y-2.5 ${className ?? ""}`}
      role="progressbar"
      aria-busy={!done}
      aria-valuenow={displayPct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles
            className={`h-4 w-4 shrink-0 text-[var(--color-primary)] ${done ? "" : "animate-pulse"}`}
            aria-hidden
          />
          <span className="truncate font-medium text-[var(--color-ink)]">
            {label}
          </span>
        </div>
        <span
          className="font-mono text-xs tabular-nums text-[var(--color-muted)]"
          aria-hidden
        >
          {displayPct}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-primary-soft)]">
        <div
          className="h-full rounded-[var(--radius-pill)] bg-[var(--color-primary)]"
          style={{
            width: `${displayPct}%`,
            transition: "width 220ms ease-out",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Stage preset for the candidate's Profile Score recompute.
 *
 * Targets typical pipeline latencies observed in production logs:
 *   - LLM-assisted PII redaction (`redact-batch` v2.0.0): ~13s
 *   - Structured profile scoring (`score-profile`): ~4s
 *   - Engine reconciliation + persist: <1s
 */
export const PROFILE_SCORE_STAGES: ProgressStage[] = [
  {
    id: "redact",
    label: "Securing your information",
    percentTarget: 75,
    durationMs: 13_000,
  },
  {
    id: "score",
    label: "Analyzing your profile",
    percentTarget: 95,
    durationMs: 4_000,
  },
  {
    id: "finalize",
    label: "Finalizing your score",
    percentTarget: 99,
    durationMs: 800,
  },
];

/**
 * Stage preset for a candidate-job Match Score compute.
 *
 * Same redaction step (cached on hot paths), then a job-aware match scoring
 * pass that compares against the JD. Slightly longer scoring than profile
 * because the prompt also reasons about cultural-fit + JD alignment.
 */
export const MATCH_SCORE_STAGES: ProgressStage[] = [
  {
    id: "redact",
    label: "Securing your resume",
    percentTarget: 55,
    durationMs: 6_000,
  },
  {
    id: "score",
    label: "Matching against this role",
    percentTarget: 95,
    durationMs: 5_000,
  },
  {
    id: "finalize",
    label: "Finalizing your match",
    percentTarget: 99,
    durationMs: 800,
  },
];
