/**
 * Inline notice surfaced inside the candidate's match-preview card when
 * their score is below the auto-reject threshold. Per thesis panel
 * revision (May 2026): roles set a minimum match score for interview
 * eligibility (default 75) and applications below that floor are
 * blocked at submission.
 *
 * This component is purely informational — the actual block lives on
 * the Apply button (disabled state), the apply page (renders a
 * dedicated "below threshold" view), and the POST /applications
 * endpoint (rejects sub-threshold submissions with
 * APPLY_BELOW_INTERVIEW_THRESHOLD).
 *
 * Copy is calm + thesis-defensible: explains the rule in the
 * candidate's terms, references the actual numeric score, and does not
 * accuse the candidate of being a poor fit.
 */
import { ShieldX } from "lucide-react";

import { cn } from "@/lib/utils";

interface BelowThresholdNoticeProps {
  /** The candidate's preview match score for this job (0-100). */
  score: number;
  /** The auto-reject threshold currently in force (default 75). */
  threshold: number;
  className?: string;
}

export function BelowThresholdNotice({
  score,
  threshold,
  className,
}: BelowThresholdNoticeProps) {
  return (
    <aside
      role="alert"
      aria-label="Match score below interview threshold"
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-score-mid)] bg-[var(--color-score-mid-soft)] px-4 py-3.5 text-sm",
        className,
      )}
    >
      <ShieldX
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0 text-[var(--color-score-mid)]"
      />
      <div className="min-w-0">
        <p className="font-semibold text-[var(--color-ink)]">
          Apply is blocked for this role
        </p>
        <p className="mt-1 text-[var(--color-body)]">
          Your match score is{" "}
          <span className="font-mono font-semibold text-[var(--color-ink)]">
            {score}
          </span>{" "}
          / 100, below the{" "}
          <span className="font-mono font-semibold text-[var(--color-ink)]">
            {threshold}
          </span>{" "}
          minimum this role requires for an interview. The Apply button
          is disabled until your score reaches the threshold.
        </p>
        <p className="mt-2 text-[var(--color-muted)]">
          Update your resume to better highlight the skills this role
          calls out, then recompute the preview to try again.
        </p>
      </div>
    </aside>
  );
}
