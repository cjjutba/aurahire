"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { ScoreRing } from "./score-ring";
import { MatchBandChip } from "./match-band-chip";
import { EvidenceCallout } from "./evidence-callout";

export interface ScoreDashboardEvidence {
  excerpt: string;
  source: string;
  relevance: "positive" | "negative" | "neutral";
  contributionPoints?: number | null;
}

export interface ScoreDashboardComponent {
  name: string;
  score: number;
  max: number;
  weight: number;
  explanation: string;
  evidence: ScoreDashboardEvidence[];
}

export interface ScoreDashboardFairness {
  redactedFields: string[];
  promptVersion: string;
  modelUsed: string;
}

export interface ScoreDashboardProps {
  /** Top-of-page header (title + secondary actions). Rendered above the grid. */
  header: ReactNode;
  /** Overall numeric score (0–100). */
  overallScore: number;
  band: "strong" | "partial" | "limited";
  /** Small lines of meta shown next to the ring (computed-at, model, etc.). */
  metaLines?: ReactNode;
  /** Per-component scores and evidence. First entry is selected initially. */
  components: ScoreDashboardComponent[];
  /** Display labels keyed by component.name (`skills` → "Skills"). */
  componentLabels: Record<string, string>;
  /** Optional content rendered inside the right pane, above the active component. */
  beforeRightPane?: ReactNode;
  /** Optional sections rendered below the main grid (improvements, offers, etc.). */
  extraSections?: ReactNode;
  /** Optional fairness disclosure shown collapsed at the bottom. */
  fairness?: ScoreDashboardFairness | null;
}

function bandColors(ratio: number): { fill: string; track: string } {
  if (ratio >= 0.7) {
    return { fill: "var(--color-score-high)", track: "var(--color-score-high-soft)" };
  }
  if (ratio >= 0.4) {
    return { fill: "var(--color-score-mid)", track: "var(--color-score-mid-soft)" };
  }
  return { fill: "var(--color-score-low)", track: "var(--color-score-low-soft)" };
}

function trimQuotes(s: string): string {
  return s.replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, "").trim();
}

export function ScoreDashboard({
  header,
  overallScore,
  band,
  metaLines,
  components,
  componentLabels,
  beforeRightPane,
  extraSections,
  fairness,
}: ScoreDashboardProps) {
  const [activeName, setActiveName] = useState<string>(
    components[0]?.name ?? "",
  );

  const active = useMemo(
    () => components.find((c) => c.name === activeName) ?? components[0],
    [components, activeName],
  );

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      {header}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Left rail — sticky summary + component list */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
            <div className="flex items-center gap-4">
              <ScoreRing
                score={overallScore}
                band={band}
                size="md"
                label="of 100"
              />
              <div className="min-w-0 space-y-2">
                <MatchBandChip band={band} />
                {metaLines && (
                  <div className="space-y-1 text-xs text-[var(--color-muted)]">
                    {metaLines}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-[var(--color-hairline-soft)] pt-4">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Component Breakdown
              </h2>
              <ul className="space-y-1">
                {components.map((c) => (
                  <ComponentRow
                    key={c.name}
                    component={c}
                    label={componentLabels[c.name] ?? c.name}
                    selected={c.name === activeName}
                    onSelect={() => setActiveName(c.name)}
                  />
                ))}
              </ul>
            </div>
          </div>
        </aside>

        {/* Right pane — active component detail */}
        <section
          aria-live="polite"
          className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6"
        >
          {beforeRightPane}
          {active ? (
            <ActiveComponentPanel
              component={active}
              label={componentLabels[active.name] ?? active.name}
            />
          ) : (
            <p className="text-sm text-[var(--color-muted)]">
              No component data available.
            </p>
          )}
        </section>
      </div>

      {extraSections}

      {fairness && <FairnessDisclosure fairness={fairness} />}
    </div>
  );
}

function ComponentRow({
  component: c,
  label,
  selected,
  onSelect,
}: {
  component: ScoreDashboardComponent;
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
        className={`group w-full rounded-[var(--radius-md)] px-3 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
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
                selected ? "text-[var(--color-primary)]" : "text-[var(--color-ink)]"
              }
            >
              {c.score}
            </span>
            <span className="text-[var(--color-muted)]"> / {c.max}</span>
          </span>
        </div>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-[var(--radius-pill)]"
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
}: {
  component: ScoreDashboardComponent;
  label: string;
}) {
  const ratio = c.max > 0 ? c.score / c.max : 0;
  const colors = bandColors(ratio);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-hairline-soft)] pb-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">
            {label}
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Weight {Math.round(c.weight * 100)}% of overall score
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl text-[var(--color-ink)]">
            {c.score}
            <span className="text-sm text-[var(--color-muted)]"> / {c.max}</span>
          </div>
          <div
            className="mt-1 h-1.5 w-32 overflow-hidden rounded-[var(--radius-pill)]"
            style={{ backgroundColor: colors.track }}
          >
            <div
              className="h-full"
              style={{ width: `${ratio * 100}%`, backgroundColor: colors.fill }}
            />
          </div>
        </div>
      </header>

      <p className="text-sm leading-relaxed text-[var(--color-body)]">
        {c.explanation}
      </p>

      {c.evidence.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-4 text-center text-xs text-[var(--color-muted)]">
          No evidence cited for this component.
        </p>
      ) : (
        <div className="space-y-3">
          {c.evidence.map((ev, i) => (
            <EvidenceCallout
              key={`${c.name}-ev-${i}`}
              excerpt={trimQuotes(ev.excerpt)}
              source={ev.source}
              relevance={ev.relevance}
              contributionPoints={ev.contributionPoints ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FairnessDisclosure({ fairness: f }: { fairness: ScoreDashboardFairness }) {
  return (
    <details className="group rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Fairness &amp; Transparency
          </h2>
          <p className="mt-1 text-sm text-[var(--color-body)]">
            Personal information was redacted before scoring.
          </p>
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform group-open:rotate-90"
          aria-hidden
        />
      </summary>
      <div className="mt-4 space-y-3 border-t border-[var(--color-hairline-soft)] pt-4 text-sm text-[var(--color-body)]">
        <p>
          Before scoring, we redacted personal information from your resume so
          the AI scores you on your skills and experience — not on identity
          markers.
        </p>
        {f.redactedFields.length > 0 && (
          <p className="text-xs text-[var(--color-muted)]">
            <strong className="text-[var(--color-body)]">
              Redacted before scoring:
            </strong>{" "}
            {f.redactedFields.join(", ")}
          </p>
        )}
        <p className="text-xs text-[var(--color-muted)]">
          Scored by <span className="font-mono">{f.modelUsed}</span> with prompt
          v{f.promptVersion}.
        </p>
      </div>
    </details>
  );
}
