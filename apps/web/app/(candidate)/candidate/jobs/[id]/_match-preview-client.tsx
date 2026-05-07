"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, ChevronRight, AlertCircle } from "lucide-react";

import { ScoreRing } from "@/components/score/score-ring";
import { MatchBandChip } from "@/components/score/match-band-chip";
import { EvidenceCallout } from "@/components/score/evidence-callout";
import { AiShimmer } from "@/components/ai/ai-shimmer";
import { Button } from "@/components/ui/button";
import { toastApiError } from "@/lib/toast";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

const COMPONENT_LABELS: Record<string, string> = {
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  cultural_fit: "Cultural Fit",
};

interface PreviewEvidence {
  excerpt: string;
  source: string;
  relevance: "positive" | "negative" | "neutral";
  contributionPoints: number | null;
}

interface PreviewComponent {
  name: string;
  score: number;
  max: number;
  weight: number;
  explanation: string;
  evidence: PreviewEvidence[];
}

interface MatchPreviewData {
  id: string;
  jobId: string;
  resumeId: string;
  overallScore: number;
  band: "strong" | "partial" | "limited";
  components: PreviewComponent[];
  redactedFields: string[];
  promptVersion: string;
  modelUsed: string;
  latencyMs: number;
  source: "system" | "candidate";
  createdAt: string;
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

interface MatchPreviewClientProps {
  jobId: string;
  /** Hidden when the candidate has already applied — they should view their application instead. */
  hidden?: boolean;
}

export function MatchPreviewClient({ jobId, hidden }: MatchPreviewClientProps) {
  const [preview, setPreview] = useState<MatchPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [activeName, setActiveName] = useState<string>("");
  const [showAllComponents, setShowAllComponents] = useState(false);

  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

  // Initial fetch — surfaces auto-precomputed previews instantly without
  // requiring the candidate to click anything.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) setLoading(false);
          return;
        }

        const res = await fetch(
          `${apiUrl}/api/v1/scoring/match-preview/${jobId}`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: "no-store",
          },
        );
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as { data: MatchPreviewData | null };
          if (body.data) {
            setPreview(body.data);
            setActiveName(body.data.components[0]?.name ?? "");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, apiUrl]);

  async function compute(force = false) {
    setComputing(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `${apiUrl}/api/v1/scoring/match-preview/${jobId}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      if (res.status === 429) {
        toastApiError(
          null,
          "Couldn't compute match",
          "Please wait a moment before trying again.",
        );
        return;
      }
      if (res.status === 400) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
          code?: string;
        } | null;
        const message = body?.message ?? "Make sure you've uploaded a resume first.";
        toastApiError(null, "Couldn't compute match", message);
        return;
      }
      if (!res.ok) {
        toastApiError(null, "Couldn't compute match");
        return;
      }
      const body = (await res.json()) as { data: MatchPreviewData };
      setPreview(body.data);
      setActiveName(body.data.components[0]?.name ?? "");
      setShowAllComponents(false);
      // Suppress unused lint hint without changing behaviour
      void force;
    } finally {
      setComputing(false);
    }
  }

  const active = useMemo(
    () =>
      preview?.components.find((c) => c.name === activeName) ??
      preview?.components[0] ??
      null,
    [preview, activeName],
  );

  if (hidden) return null;

  // Loading initial fetch — quietly skeleton the whole card.
  if (loading) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          <Sparkles className="h-3.5 w-3.5 text-[var(--color-primary)]" />
          Match Preview
        </div>
        <div className="mt-3 h-24 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-soft)]" />
      </div>
    );
  }

  // Empty state — no preview yet, candidate can request one.
  if (!preview) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <header className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Match Preview
          </h2>
        </header>
        {computing ? (
          <AiShimmer
            caption="Scoring your resume against this job…"
            height={120}
          />
        ) : (
          <>
            <p className="text-sm text-[var(--color-body)]">
              See how your resume scores against this role <strong>before</strong>{" "}
              you apply. We&apos;ll redact your personal information first and
              show every component of the score.
            </p>
            <Button
              onClick={() => compute(false)}
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
            >
              <Sparkles className="h-4 w-4" />
              See my match
            </Button>
          </>
        )}
      </div>
    );
  }

  // Loaded — render the inline ScoreDashboard variant (compact).
  const total = preview.overallScore;

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Match Preview
          </h2>
          {preview.source === "system" && (
            <span className="rounded-[var(--radius-pill)] bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
              Auto
            </span>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => compute(true)}
          disabled={computing}
          className="h-8 rounded-[var(--radius-pill)] px-3 text-xs"
        >
          {computing ? "Recomputing…" : "Recompute"}
        </Button>
      </header>

      {computing ? (
        <AiShimmer caption="Recomputing match score…" height={120} />
      ) : (
        <>
          {/* Top: ring + meta + breakdown bars */}
          <div className="flex flex-wrap items-center gap-5">
            <ScoreRing
              score={total}
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
              <p className="text-xs text-[var(--color-muted)]">
                Apply now to lock this score in — no recompute required.
              </p>
            </div>
          </div>

          {/* Component breakdown — clickable rows */}
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

          {/* Active component detail (collapsed by default; shows on click). */}
          {showAllComponents && active && (
            <ActiveComponentPanel
              component={active}
              label={COMPONENT_LABELS[active.name] ?? active.name}
              className="mt-5 border-t border-[var(--color-hairline-soft)] pt-5"
            />
          )}

          {/* Toggle for the panel */}
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

          {/* Fairness footnote */}
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
        </>
      )}
    </div>
  );
}

function ComponentRow({
  component: c,
  label,
  selected,
  onSelect,
}: {
  component: PreviewComponent;
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
                selected ? "text-[var(--color-primary)]" : "text-[var(--color-ink)]"
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
  component: PreviewComponent;
  label: string;
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-base font-semibold text-[var(--color-ink)]">
          {label}
        </h3>
        <span className="font-mono text-sm text-[var(--color-muted)]">
          {c.score}
          <span className="text-[var(--color-muted)]"> / {c.max}</span>
          <span className="ml-2 text-[var(--color-muted)]">
            (weight {Math.round(c.weight * 100)}%)
          </span>
        </span>
      </header>
      <p className="text-sm leading-relaxed text-[var(--color-body)]">
        {c.explanation}
      </p>
      {c.evidence.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-3 text-center text-xs text-[var(--color-muted)]">
          No evidence cited for this component.
        </p>
      ) : (
        <div className="space-y-2.5">
          {c.evidence.map((ev, i) => (
            <EvidenceCallout
              key={`${c.name}-ev-${i}`}
              excerpt={trimQuotes(ev.excerpt)}
              source={ev.source}
              relevance={ev.relevance}
              contributionPoints={ev.contributionPoints}
            />
          ))}
        </div>
      )}
    </div>
  );
}
