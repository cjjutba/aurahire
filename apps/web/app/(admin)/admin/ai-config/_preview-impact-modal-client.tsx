"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

interface ProposedConfig {
  matchWeights: {
    skills: number;
    experience: number;
    education: number;
    cultural_fit: number;
  };
  bandThresholds: { strong: number; partial: number };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposedConfig: ProposedConfig;
  onConfirmSave: () => void | Promise<void>;
}

interface PreviewBody {
  data: {
    sampledCount: number;
    current: {
      strong: number;
      partial: number;
      limited: number;
      avgScore: number;
    };
    proposed: {
      strong: number;
      partial: number;
      limited: number;
      avgScore: number;
    };
    delta: {
      strong: number;
      partial: number;
      limited: number;
      avgScore: number;
    };
    examples: Array<{
      applicationId: string;
      candidateName: string;
      jobTitle: string;
      currentScore: number;
      proposedScore: number;
      currentBand: string;
      proposedBand: string;
    }>;
  };
}

const BAND_COLOR = {
  strong: "var(--color-score-high)",
  partial: "var(--color-score-mid)",
  limited: "var(--color-score-low)",
} as const;

function deltaText(n: number, suffix = ""): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}${suffix}`;
}

function deltaTone(n: number): string {
  if (n === 0) return "text-[var(--color-muted)]";
  return n > 0
    ? "text-[var(--color-score-high)]"
    : "text-[var(--color-status-danger)]";
}

export function PreviewImpactModalClient({
  open,
  onOpenChange,
  proposedConfig,
  onConfirmSave,
}: Props) {
  const [data, setData] = useState<PreviewBody["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on close
      setData(null);
      setError(null);
      return;
    }
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setError("Not signed in");
          return;
        }
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
        const res = await fetch(
          `${apiUrl}/api/v1/admin/scoring-config/preview-impact`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ proposedConfig, sampleSize: 100 }),
          },
        );
        if (!res.ok) {
          setError(`Preview failed (${res.status})`);
          return;
        }
        const body = (await res.json()) as PreviewBody;
        setData(body.data);
      } finally {
        setLoading(false);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function renderDistributionBar(
    title: string,
    dist: {
      strong: number;
      partial: number;
      limited: number;
      avgScore: number;
    },
    total: number,
  ) {
    const barFor = (count: number, color: string, label: string) => {
      const pct = total > 0 ? (count / total) * 100 : 0;
      return (
        <div className="space-y-1">
          <div className="flex items-baseline justify-between text-xs">
            <span className="capitalize text-[var(--color-body)]">{label}</span>
            <span className="font-mono text-[var(--color-muted)]">
              {count} · {Math.round(pct)}%
            </span>
          </div>
          <div className="h-2 w-full rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)]">
            <div
              className="h-2 rounded-[var(--radius-pill)] transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-4">
        <header className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold tracking-wider text-[var(--color-muted)] uppercase">
            {title}
          </h3>
          <span className="font-mono text-xs text-[var(--color-muted)]">
            avg {dist.avgScore}
          </span>
        </header>
        {barFor(dist.strong, BAND_COLOR.strong, "strong")}
        {barFor(dist.partial, BAND_COLOR.partial, "partial")}
        {barFor(dist.limited, BAND_COLOR.limited, "limited")}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview Impact</DialogTitle>
          <DialogDescription>
            {loading
              ? "Re-weighting recent match scores..."
              : data
                ? `Re-weighted ${data.sampledCount} most recent match score${data.sampledCount === 1 ? "" : "s"} using the proposed configuration. No new AI calls.`
                : ""}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--color-muted)]" />
          </div>
        )}

        {error && (
          <p className="py-6 text-sm text-[var(--color-status-danger)]">
            {error}
          </p>
        )}

        {data && data.sampledCount === 0 && (
          <p className="py-6 text-sm text-[var(--color-body)]">
            Need at least 1 scored application to preview impact. Apply to a job
            first to populate match scores.
          </p>
        )}

        {data && data.sampledCount > 0 && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {renderDistributionBar(
                "Current Weights",
                data.current,
                data.sampledCount,
              )}
              {renderDistributionBar(
                "Proposed Weights",
                data.proposed,
                data.sampledCount,
              )}
            </div>

            {/* Delta callout */}
            <div className="flex flex-wrap items-baseline gap-4 rounded-[var(--radius-lg)] border border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)] p-4 text-sm">
              <span className="font-semibold tracking-wider text-[var(--color-primary)] uppercase">
                Δ
              </span>
              <span>
                Strong{" "}
                <strong className={`font-mono ${deltaTone(data.delta.strong)}`}>
                  {deltaText(data.delta.strong)}
                </strong>
              </span>
              <span>
                Partial{" "}
                <strong
                  className={`font-mono ${deltaTone(data.delta.partial)}`}
                >
                  {deltaText(data.delta.partial)}
                </strong>
              </span>
              <span>
                Limited{" "}
                <strong
                  className={`font-mono ${deltaTone(data.delta.limited)}`}
                >
                  {deltaText(data.delta.limited)}
                </strong>
              </span>
              <span className="border-l border-[var(--color-hairline)] pl-4">
                Avg score{" "}
                <strong className="font-mono text-[var(--color-ink)]">
                  {data.current.avgScore}
                </strong>{" "}
                →{" "}
                <strong className="font-mono text-[var(--color-ink)]">
                  {data.proposed.avgScore}
                </strong>{" "}
                <span className={`font-mono ${deltaTone(data.delta.avgScore)}`}>
                  ({deltaText(data.delta.avgScore)})
                </span>
              </span>
            </div>

            {/* Top movers */}
            {data.examples.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold tracking-wider text-[var(--color-muted)] uppercase">
                  Top movers (largest absolute change)
                </h3>
                <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-hairline)]">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-hairline)] text-left text-xs tracking-wider text-[var(--color-muted)] uppercase">
                        <th className="p-3">Candidate</th>
                        <th className="p-3">Job</th>
                        <th className="p-3 text-center">Score</th>
                        <th className="p-3 text-center">Band</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.examples.map((e) => {
                        const delta = e.proposedScore - e.currentScore;
                        const bandChanged = e.currentBand !== e.proposedBand;
                        return (
                          <tr
                            key={e.applicationId}
                            className="border-b border-[var(--color-hairline-soft)] last:border-b-0"
                          >
                            <td className="p-3 text-[var(--color-ink)]">
                              {e.candidateName}
                            </td>
                            <td className="p-3 text-[var(--color-body)]">
                              {e.jobTitle}
                            </td>
                            <td className="p-3 text-center font-mono">
                              {e.currentScore} → {e.proposedScore}{" "}
                              <span className={deltaTone(delta)}>
                                ({deltaText(delta)})
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {bandChanged ? (
                                <span className="font-mono text-xs">
                                  <span className="capitalize">
                                    {e.currentBand}
                                  </span>{" "}
                                  →{" "}
                                  <strong className="capitalize text-[var(--color-primary)]">
                                    {e.proposedBand}
                                  </strong>
                                </span>
                              ) : (
                                <span className="text-xs text-[var(--color-muted)] capitalize">
                                  {e.currentBand}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-[var(--radius-pill)]"
          >
            Close
          </Button>
          {data && data.sampledCount > 0 && (
            <Button
              onClick={() => void onConfirmSave()}
              className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
            >
              Save these weights
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
