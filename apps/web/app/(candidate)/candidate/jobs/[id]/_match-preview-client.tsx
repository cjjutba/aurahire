"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Sparkles, ChevronRight, AlertCircle, RotateCw } from "lucide-react";

import { ScoreRing } from "@/components/score/score-ring";
import { MatchBandChip } from "@/components/score/match-band-chip";
import { EvidenceCallout } from "@/components/score/evidence-callout";
import { AiShimmer } from "@/components/ai/ai-shimmer";
import { Button } from "@/components/ui/button";
import { ClientApiError, clientApiFetch } from "@/hooks/_client-fetch";
import { useConfirm } from "@/components/providers/confirm-provider";

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
  source: "system" | "candidate" | "candidate_view";
  createdAt: string;
}

interface MatchPreviewEnvelope {
  data: MatchPreviewData | null;
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

/**
 * Reads the API error body shape thrown by `clientApiFetch`. Backend
 * exceptions follow `{ code, message, ...details }`. We only need the code +
 * message here.
 */
function readErrorBody(err: unknown): { status: number; code: string | null; message: string | null } | null {
  if (!(err instanceof ClientApiError)) return null;
  const body = err.body as { code?: string; message?: string } | null;
  return {
    status: err.status,
    code: body?.code ?? null,
    message: body?.message ?? null,
  };
}

interface MatchPreviewClientProps {
  jobId: string;
  /** Hidden when the candidate has already applied — they should view their application instead. */
  hidden?: boolean;
}

export function MatchPreviewClient({ jobId, hidden }: MatchPreviewClientProps) {
  const confirm = useConfirm();
  const qc = useQueryClient();
  // `null` = derive from the preview (first component); a string = the user
  // explicitly selected this component. Keeps the "follow the data" default
  // working without a setState-in-effect pattern.
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [showAllComponents, setShowAllComponents] = useState(false);

  // GET — surfaces the precomputed preview if one already exists. The
  // backend's auto-precompute path normally fills this on first view; the
  // POST below is the on-view fallback for jobs that fall outside the top-N
  // precompute window.
  const previewQuery = useQuery<MatchPreviewEnvelope>({
    queryKey: ["candidate-match-preview", jobId] as const,
    queryFn: ({ signal }) =>
      clientApiFetch<MatchPreviewEnvelope>(
        `/api/v1/scoring/match-preview/${jobId}`,
        { signal },
      ),
    // Skip when the parent has hidden the card — the candidate has already
    // applied and we shouldn't even hit the endpoint.
    enabled: !hidden,
    staleTime: 60_000,
  });

  const preview = previewQuery.data?.data ?? null;

  // POST — computes a preview if none exists, or recomputes when the user
  // explicitly clicks "Recompute" (passes force = true via cache busting).
  const compute = useMutation<MatchPreviewEnvelope, unknown, void>({
    mutationFn: () =>
      clientApiFetch<MatchPreviewEnvelope>(
        `/api/v1/scoring/match-preview/${jobId}`,
        { method: "POST" },
      ),
    onSuccess: (envelope) => {
      // Seed the cache directly so we don't need an extra GET round-trip.
      qc.setQueryData(["candidate-match-preview", jobId], envelope);
      // Reset to the derived default so the new preview's first component
      // is highlighted.
      setSelectedName(null);
    },
  });

  // Effective active name: the user's explicit pick if any, otherwise the
  // first component of the loaded preview. Pure derivation — no useEffect.
  const activeName = selectedName ?? preview?.components[0]?.name ?? "";

  // Auto-compute on mount when no cached preview is available — replaces the
  // old "See my match" button. The ref guards against React 18+ Strict Mode
  // double-invoking the effect.
  const autoFired = useRef(false);
  useEffect(() => {
    if (hidden) return;
    if (previewQuery.isLoading) return;
    if (preview) return;
    if (compute.isPending) return;
    if (compute.isError) return;
    if (autoFired.current) return;
    autoFired.current = true;
    compute.mutate();
  }, [hidden, previewQuery.isLoading, preview, compute]);

  async function recompute() {
    const ok = await confirm({
      title: "Recompute your match?",
      description:
        "AI will rescore your resume against this job. This replaces your current preview and may take a few seconds.",
      confirmLabel: "Recompute match",
      variant: "warning",
    });
    if (!ok) return;
    compute.mutate();
  }

  const active = useMemo(
    () =>
      preview?.components.find((c) => c.name === activeName) ??
      preview?.components[0] ??
      null,
    [preview, activeName],
  );

  if (hidden) return null;

  // Initial GET still resolving — quietly skeleton the whole card so we
  // don't flash the "computing" shimmer for the common cache-hit path.
  if (previewQuery.isLoading) {
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

  // No preview AND compute returned an error — translate to a focused error
  // surface depending on the code.
  if (!preview && compute.isError) {
    const errBody = readErrorBody(compute.error);

    // 429 DAILY_AI_LIMIT — daily on-view cap reached. No retry button: the
    // candidate must apply to lock in a score.
    if (errBody?.status === 429 && errBody.code === "DAILY_AI_LIMIT") {
      return (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
          <header className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Match Preview
            </h2>
          </header>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-4">
            <p className="text-sm text-[var(--color-body)]">
              Daily AI compute limit reached. Apply to score this match as part
              of your application.
            </p>
            <Link
              href={`/candidate/jobs/${jobId}/apply`}
              className="mt-3 inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
            >
              Apply now
            </Link>
          </div>
        </div>
      );
    }

    // 422 / 400 NO_DEFAULT_RESUME — candidate hasn't uploaded a resume yet.
    // The actual backend code is `NO_DEFAULT_RESUME` (400), but defending
    // against a future 422 variant is cheap.
    if (errBody?.code === "NO_DEFAULT_RESUME") {
      return (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
          <header className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Match Preview
            </h2>
          </header>
          <p className="text-sm text-[var(--color-body)]">
            Upload a resume to see your match.
          </p>
          <Link
            href="/candidate/profile/resumes"
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
          >
            Upload resume
          </Link>
        </div>
      );
    }

    // 5xx / generic error — the cap doesn't apply since no row landed, so a
    // retry button is safe.
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <header className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Match Preview
          </h2>
        </header>
        <p className="text-sm text-[var(--color-body)]">
          Couldn&apos;t compute your match
          {errBody?.message ? `: ${errBody.message}` : "."}
        </p>
        <Button
          onClick={() => compute.mutate()}
          disabled={compute.isPending}
          className="mt-3 inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          <RotateCw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  // Computing — either auto-compute is in flight or we have no preview yet
  // and no error. Always paired with a caption per design rules.
  if (!preview || compute.isPending) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <header className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Match Preview
          </h2>
        </header>
        <AiShimmer
          caption="Computing your match for this role…"
          height={120}
        />
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
          onClick={recompute}
          disabled={compute.isPending}
          className="h-8 rounded-[var(--radius-pill)] px-3 text-xs"
        >
          {compute.isPending ? "Recomputing…" : "Recompute"}
        </Button>
      </header>

      {compute.isPending ? (
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
                    setSelectedName(c.name);
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
            <PreviewEvidenceGroup
              tone="gap"
              heading="Gaps — what kept this from a perfect score"
              items={negatives}
              componentName={c.name}
            />
          )}
          {positives.length > 0 && (
            <PreviewEvidenceGroup
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PreviewEvidenceGroup({
  tone,
  heading,
  items,
  componentName,
}: {
  tone: "strength" | "gap";
  heading: string;
  items: PreviewEvidence[];
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
          />
        ))}
      </div>
    </section>
  );
}
