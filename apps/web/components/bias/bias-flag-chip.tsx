"use client";

import { AlertTriangle, Info } from "lucide-react";
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
  onSelect?: () => void;
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

// Severity → chip palette. LOW renders in a muted info treatment so it reads
// as informational, not blocking. MEDIUM/HIGH keep the amber alert palette
// because those are the severities that gate publish (see jobs.service.ts).
function chipPaletteFor(severity: BiasFlagChipFlag["severity"]): string {
  if (severity === "low") {
    return "bg-[var(--color-surface-strong)] text-[var(--color-body)]";
  }
  if (severity === "high") {
    return "bg-[var(--color-score-low-soft)] text-[var(--color-score-low)]";
  }
  // medium (default for null/undefined too — assume blocking)
  return "bg-[var(--color-score-mid-soft)] text-[var(--color-score-mid)]";
}

function categoryLabelColorFor(severity: BiasFlagChipFlag["severity"]): string {
  if (severity === "low") return "text-[var(--color-muted)]";
  if (severity === "high") return "text-[var(--color-score-low)]";
  return "text-[var(--color-score-mid)]";
}

export function BiasFlagChip({ flag, onOverride, onDismiss, onSelect }: Props) {
  const isOverridden = flag.status === "overridden";
  const isResolved = flag.status === "resolved";

  const chipColors = isOverridden
    ? "bg-[var(--color-surface-strong)] text-[var(--color-muted)]"
    : isResolved
      ? "bg-[var(--color-score-high-soft)] text-[var(--color-score-high)]"
      : chipPaletteFor(flag.severity);

  const isLow = flag.severity === "low" && !isOverridden && !isResolved;
  const ChipIcon = isLow ? Info : AlertTriangle;

  return (
    <Popover>
      <PopoverTrigger
        className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-medium ${chipColors} transition hover:opacity-80`}
        onClick={onSelect}
      >
        <ChipIcon className="h-3 w-3" />
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
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${categoryLabelColorFor(flag.severity)}`}
            >
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
          {isLow && (
            <p className="text-xs italic text-[var(--color-muted)]">
              Informational — does not block publish.
            </p>
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
