"use client";

import { AlertTriangle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface BiasFlagChipFlag {
  id?: string;
  term: string;
  category: string;
  severity?: "high" | "medium" | "low" | null;
  explanation?: string | null;
  suggestion?: string | null;
  status?: "flagged" | "overridden" | "resolved";
}

interface Props {
  flag: BiasFlagChipFlag;
  onOverride?: () => void;
  onDismiss?: () => void;
}

const SEVERITY_LABEL: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const CATEGORY_LABEL: Record<string, string> = {
  gendered: "Gendered",
  "age-coded": "Age-coded",
  ableist: "Ableist",
  exclusionary: "Exclusionary",
  other: "Other",
};

export function BiasFlagChip({ flag, onOverride, onDismiss }: Props) {
  const isOverridden = flag.status === "overridden";
  const isResolved = flag.status === "resolved";

  const chipColors = isOverridden
    ? "bg-[var(--color-surface-strong)] text-[var(--color-muted)]"
    : isResolved
      ? "bg-[var(--color-score-high-soft)] text-[var(--color-score-high)]"
      : "bg-[var(--color-score-mid-soft)] text-[var(--color-score-mid)]";

  return (
    <Popover>
      <PopoverTrigger
        className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-medium ${chipColors} transition hover:opacity-80`}
      >
        <AlertTriangle className="h-3 w-3" />
        <span>&ldquo;{flag.term}&rdquo;</span>
        {flag.severity && (
          <span className="text-[10px] uppercase tracking-wider opacity-70">
            {SEVERITY_LABEL[flag.severity]}
          </span>
        )}
        {isOverridden && <span className="text-[10px]">(overridden)</span>}
      </PopoverTrigger>
      <PopoverContent className="w-80 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4 shadow-md">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-score-mid)]">
              {CATEGORY_LABEL[flag.category] ?? flag.category}
            </span>
            {flag.severity && (
              <span className="text-xs text-[var(--color-muted)]">
                Severity: {SEVERITY_LABEL[flag.severity]}
              </span>
            )}
          </div>
          {flag.explanation && (
            <p className="text-sm text-[var(--color-body)]">{flag.explanation}</p>
          )}
          {flag.suggestion && (
            <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Suggestion
              </p>
              <p className="mt-1 text-sm text-[var(--color-ink)]">
                {flag.suggestion}
              </p>
            </div>
          )}
          {(onOverride || onDismiss) && !isOverridden && !isResolved && (
            <div className="flex gap-2 pt-2">
              {onOverride && (
                <button
                  type="button"
                  onClick={onOverride}
                  className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
                >
                  Override
                </button>
              )}
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-3 py-1 text-xs text-[var(--color-body)] hover:bg-[var(--color-surface-soft)]"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
          {isOverridden && (
            <p className="text-xs italic text-[var(--color-muted)]">
              This flag was overridden by the recruiter.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
