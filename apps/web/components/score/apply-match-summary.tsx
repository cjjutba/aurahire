"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ChevronRight, RotateCcw, Sparkles } from "lucide-react";

import { EvidenceCallout } from "@/components/score/evidence-callout";
import { MatchBandChip } from "@/components/score/match-band-chip";
import { ScoreRing } from "@/components/score/score-ring";

const COMPONENT_LABELS: Record<string, string> = {
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  cultural_fit: "Cultural Fit",
};

export interface ApplyMatchPreviewEvidence {
  excerpt: string;
  source: string;
  relevance: "positive" | "negative" | "neutral";
  contributionPoints: number | null;
  reasoning?: string | null;
}

export interface ApplyMatchPreviewComponent {
  name: string;
  score: number;
  max: number;
  weight: number;
  explanation: string;
  evidence: ApplyMatchPreviewEvidence[];
}

export interface ApplyMatchCalibrationWarning {
  componentName: string;
  reason: "ceiling_with_thin_evidence" | "deduction_without_negative_evidence";
}

export interface ApplyMatchPreview {
  id: string;
  jobId: string;
  resumeId: string;
  overallScore: number;
  band: "strong" | "partial" | "limited";
  components: ApplyMatchPreviewComponent[];
  redactedFields: string[];
  promptVersion: string;
  modelUsed: string;
  latencyMs: number;
  source: "system" | "candidate";
  createdAt: string;
  calibrationWarnings?: ApplyMatchCalibrationWarning[];
}

interface ApplyMatchSummaryProps {
  preview: ApplyMatchPreview;
  /**
   * Whether the resume currently selected in the apply form matches the
   * resume the preview was scored against. Drives the dimmed/ribbon state.
   */
  selectedResumeMatchesPreview: boolean;
  /**
   * Called when the user clicks the "switch back" ribbon, the form client
   * resets the resume picker to `preview.resumeId`.
   */
  onSwitchToPreviewResume: () => void;
}

function bandColors(ratio: number): { fill: string; track: string } {
  if (ratio >= 0.7) {
    return {
      fill: "var(--color-score-high)",
      track: "var(--color-score-high-soft)",
    };
  }
  if (ratio >= 0.4) {
    return {
      fill: "var(--color-score-mid)",
      track: "var(--color-score-mid-soft)",
    };
  }
  return {
    fill: "var(--color-score-low)",
    track: "var(--color-score-low-soft)",
  };
}

function trimQuotes(s: string): string {
  return s
    .replace(
      /^["'`\u201c\u201d\u2018\u2019]+|["'`\u201c\u201d\u2018\u2019]+$/g,
      "",
    )
    .trim();
}

export function ApplyMatchSummary({
  preview,
  selectedResumeMatchesPreview,
  onSwitchToPreviewResume,
}: ApplyMatchSummaryProps) {
  const [activeName, setActiveName] = useState<string>(
    preview.components[0]?.name ?? "",
  );
  const [showAllComponents, setShowAllComponents] = useState(false);

  const active = useMemo(
    () =>
      preview.components.find((c) => c.name === activeName) ??
      preview.components[0] ??
      null,
    [preview, activeName],
  );

  const dimmed = !selectedResumeMatchesPreview;

  return (
    <div
      className={[
        "rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 transition",
        dimmed ? "opacity-60" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {dimmed && (
        <button
          type="button"
          onClick={onSwitchToPreviewResume}
          className="mb-4 flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-strong)] px-3 py-2 text-left text-xs text-[var(--color-body)] transition hover:bg-[var(--color-surface-soft)]"
        >
          <span>
            This was scored against your default resume. Switching back will
            lock in this score.
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 font-medium text-[var(--color-primary)]">
            <RotateCcw className="h-3 w-3" />
            Switch back
          </span>
        </button>
      )}

      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Match Summary
          </h2>
          {!dimmed && (
            <span className="rounded-[var(--radius-pill)] bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
              Locked-in on apply
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-5">
        <ScoreRing
          score={preview.overallScore}
          band={preview.band}
          size="md"
          label="of 100"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <MatchBandChip band={preview.band} />
          <p className="text-xs text-[var(--color-muted)]">
            Computed{" "}
            {new Date(preview.createdAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            · <span className="font-mono">{preview.latencyMs}ms</span> ·{" "}
            {preview.modelUsed}
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-[var(--color-hairline-soft)] pt-4">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Component Breakdown
        </h3>
        <ul className="grid gap-1 sm:grid-cols-2">
          {preview.components.map((c) => (
            <ComponentRow
              key={c.name}
              component={c}
              label={COMPONENT_LABELS[c.name] ?? c.name}
              selected={c.name === activeName}
              onSelect={() => {
                setActiveName(c.name);
                setShowAllComponents(true);
              }}
            />
          ))}
        </ul>
      </div>

      {showAllComponents && active && (
        <ActiveComponentPanel
          component={active}
          label={COMPONENT_LABELS[active.name] ?? active.name}
          className="mt-5 border-t border-[var(--color-hairline-soft)] pt-5"
        />
      )}

      {!showAllComponents && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setShowAllComponents(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
          >
            Show evidence and explanations
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <p className="mt-5 flex items-start gap-2 border-t border-[var(--color-hairline-soft)] pt-4 text-[11px] text-[var(--color-muted)]">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Personal info was redacted before scoring (
          {preview.redactedFields.length > 0
            ? `${preview.redactedFields.length} fields removed`
            : "no identifying fields detected"}
          ). Score reflects skills + experience match only.
        </span>
      </p>
    </div>
  );
}

function ComponentRow({
  component: c,
  label,
  selected,
  onSelect,
}: {
  component: ApplyMatchPreviewComponent;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const ratio = c.max > 0 ? c.score / c.max : 0;
  const colors = bandColors(ratio);
  const filledPct = ratio * 100;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`group w-full rounded-[var(--radius-md)] px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
          selected
            ? "bg-[var(--color-primary-soft)]"
            : "hover:bg-[var(--color-surface-soft)]"
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`text-sm font-medium ${
              selected
                ? "text-[var(--color-primary)]"
                : "text-[var(--color-ink)]"
            }`}
          >
            {label}
          </span>
          <span className="font-mono text-xs text-[var(--color-muted)]">
            <span
              className={
                selected
                  ? "text-[var(--color-primary)]"
                  : "text-[var(--color-ink)]"
              }
            >
              {c.score}
            </span>
            <span className="text-[var(--color-muted)]"> / {c.max}</span>
          </span>
        </div>
        <div
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-[var(--radius-pill)]"
          style={{ backgroundColor: colors.track }}
        >
          <div
            className="h-full rounded-[var(--radius-pill)]"
            style={{
              width: `${filledPct}%`,
              backgroundColor: colors.fill,
              transition: "width 600ms ease-out",
            }}
          />
        </div>
      </button>
    </li>
  );
}

function ActiveComponentPanel({
  component: c,
  label,
  className,
}: {
  component: ApplyMatchPreviewComponent;
  label: string;
  className?: string;
}) {
  const deficit = Math.max(0, c.max - c.score);
  const positives = c.evidence.filter((ev) => ev.relevance !== "negative");
  const negatives = c.evidence.filter((ev) => ev.relevance === "negative");
  const grouped = negatives.length > 0;

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-base font-semibold text-[var(--color-ink)]">
          {label}
        </h3>
        <div className="text-right">
          <span className="font-mono text-sm text-[var(--color-muted)]">
            {c.score}
            <span className="text-[var(--color-muted)]"> / {c.max}</span>
            <span className="ml-2 text-[var(--color-muted)]">
              (weight {c.weight}%)
            </span>
          </span>
          {deficit > 0 && (
            <p
              className="mt-0.5 font-mono text-[11px]"
              style={{ color: "var(--color-score-low)" }}
            >
              −{deficit} {deficit === 1 ? "pt" : "pts"} to perfect
            </p>
          )}
        </div>
      </header>
      <p className="text-sm leading-relaxed text-[var(--color-body)]">
        {c.explanation}
      </p>
      {c.evidence.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-3 text-center text-xs text-[var(--color-muted)]">
          No evidence cited for this component.
        </p>
      ) : grouped ? (
        <div className="space-y-4">
          {negatives.length > 0 && (
            <ApplyEvidenceGroup
              tone="gap"
              heading="Gaps, why this isn't a perfect score"
              items={negatives}
              componentName={c.name}
            />
          )}
          {positives.length > 0 && (
            <ApplyEvidenceGroup
              tone="strength"
              heading="Strengths"
              items={positives}
              componentName={c.name}
            />
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {c.evidence.map((ev, i) => (
            <EvidenceCallout
              key={`${c.name}-ev-${i}`}
              excerpt={trimQuotes(ev.excerpt)}
              source={ev.source}
              relevance={ev.relevance}
              contributionPoints={ev.contributionPoints}
              reasoning={ev.reasoning ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ApplyEvidenceGroup({
  tone,
  heading,
  items,
  componentName,
}: {
  tone: "strength" | "gap";
  heading: string;
  items: ApplyMatchPreviewEvidence[];
  componentName: string;
}) {
  const dotColor =
    tone === "gap" ? "var(--color-score-low)" : "var(--color-score-high)";
  return (
    <section className="space-y-2.5">
      <h4
        className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: dotColor }}
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: dotColor }}
          aria-hidden
        />
        {heading}
      </h4>
      <div className="space-y-2.5">
        {items.map((ev, i) => (
          <EvidenceCallout
            key={`${componentName}-${tone}-${i}`}
            excerpt={trimQuotes(ev.excerpt)}
            source={ev.source}
            relevance={ev.relevance}
            contributionPoints={ev.contributionPoints}
            reasoning={ev.reasoning ?? null}
          />
        ))}
      </div>
    </section>
  );
}
