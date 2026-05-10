"use client";

import { Sparkles } from "lucide-react";

const REASON_LABELS: Record<string, string> = {
  ceiling_with_thin_evidence: "Ceiling with thin evidence",
  deduction_without_negative_evidence: "Deduction without negative evidence",
};

const COMPONENT_LABELS: Record<string, string> = {
  completeness: "Completeness",
  skill_depth: "Skill Depth",
  experience_clarity: "Experience Clarity",
  education_quality: "Education Quality",
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  cultural_fit: "Cultural Fit",
};

interface ScoringQualityProps {
  totalWarnings: number;
  byReason: Array<{ reason: string; count: number }>;
  byComponent: Array<{ componentName: string; count: number }>;
  recent: Array<{
    auditLogId: string;
    componentName: string;
    reason: string;
    promptVersion: string;
    createdAt: string;
  }>;
}

export function ScoringQualityPanel({
  totalWarnings,
  byReason,
  byComponent,
  recent,
}: ScoringQualityProps) {
  if (totalWarnings === 0) {
    return (
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <header className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Scoring Quality
          </h2>
        </header>
        <p className="text-sm text-[var(--color-body)]">
          No calibration warnings in this range. The model is honoring the
          v1.2.0 prompt rules (ceiling requires strong evidence; deductions
          require negative evidence).
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <header className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Scoring Quality
        </h2>
        <span className="ml-auto font-mono text-xs text-[var(--color-muted)]">
          {totalWarnings} warning{totalWarnings === 1 ? "" : "s"}
        </span>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            By reason
          </h3>
          <ul className="space-y-1 text-sm">
            {byReason.map((r) => (
              <li key={r.reason} className="flex justify-between">
                <span className="text-[var(--color-body)]">
                  {REASON_LABELS[r.reason] ?? r.reason}
                </span>
                <span className="font-mono text-[var(--color-ink)]">
                  {r.count}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            By component
          </h3>
          <ul className="space-y-1 text-sm">
            {byComponent.map((c) => (
              <li key={c.componentName} className="flex justify-between">
                <span className="text-[var(--color-body)]">
                  {COMPONENT_LABELS[c.componentName] ?? c.componentName}
                </span>
                <span className="font-mono text-[var(--color-ink)]">
                  {c.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Recent (latest {recent.length})
          </h3>
          <ul className="space-y-1 text-xs">
            {recent.map((r) => (
              <li
                key={r.auditLogId}
                className="flex flex-wrap items-baseline gap-x-3 text-[var(--color-body)]"
              >
                <span className="font-mono text-[var(--color-muted)]">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
                <span>
                  {COMPONENT_LABELS[r.componentName] ?? r.componentName}
                </span>
                <span className="text-[var(--color-muted)]">
                  · {REASON_LABELS[r.reason] ?? r.reason}
                </span>
                <span className="ml-auto font-mono text-[var(--color-muted)]">
                  v{r.promptVersion}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
