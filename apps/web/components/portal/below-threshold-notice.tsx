/**
 * Candidate-side warning surfaced when a job preview match score falls
 * below the auto-reject threshold. Per thesis panel revision (May 2026):
 * applications scoring below the threshold (default 75) are
 * automatically rejected by the system as soon as scoring completes.
 *
 * This component does NOT block the apply action — candidate agency is
 * preserved (some candidates may want their application on record for
 * future jobs at the company, or believe the preview score is wrong).
 * It only makes the consequence transparent so the candidate makes an
 * informed choice. The confirm dialog at the call site is the second
 * gate.
 *
 * Copy is deliberately calm + thesis-defensible: explains the policy in
 * the candidate's terms, references the actual numeric score, and does
 * not accuse the candidate of being a poor fit ("Limited match for this
 * role" instead of "You are not qualified").
 */
import { AlertTriangle } from "lucide-react";

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
      <AlertTriangle
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0 text-[var(--color-score-mid)]"
      />
      <div className="min-w-0">
        <p className="font-semibold text-[var(--color-ink)]">
          Limited match for this role
        </p>
        <p className="mt-1 text-[var(--color-body)]">
          Your match score is{" "}
          <span className="font-mono font-semibold text-[var(--color-ink)]">
            {score}
          </span>{" "}
          / 100, which is below the{" "}
          <span className="font-mono font-semibold text-[var(--color-ink)]">
            {threshold}
          </span>{" "}
          minimum this role requires for an interview. If you submit, the
          system will auto-reject the application as soon as final
          scoring completes &mdash; usually within a few seconds.
        </p>
        <p className="mt-2 text-[var(--color-muted)]">
          You can still apply if you&apos;d like to leave the application
          on record, or update your resume and try again.
        </p>
      </div>
    </aside>
  );
}
