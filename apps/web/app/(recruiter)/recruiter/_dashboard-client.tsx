"use client";

import { useState } from "react";
import { ChevronDown, BarChart3, Info } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Range = "7d" | "30d" | "90d" | "all";

const RANGE_LABEL: Record<Range, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

export interface PipelineAnalyticsData {
  activeJobs: number;
  totalApps: number;
  pendingReview: number;
  inInterview: number;
  offered: number;
  hired: number;
  avgMatchScore: number;
  biasFlags: number;
}

interface PipelineAnalyticsCardProps {
  initialRange: Range;
  initialData: PipelineAnalyticsData;
  fetchForRange: (range: Range) => Promise<PipelineAnalyticsData>;
}

export function PipelineAnalyticsCard({
  initialRange,
  initialData,
  fetchForRange,
}: PipelineAnalyticsCardProps) {
  const [range, setRange] = useState<Range>(initialRange);
  const [data, setData] = useState<PipelineAnalyticsData>(initialData);
  const [loading, setLoading] = useState(false);

  async function changeRange(next: Range) {
    setRange(next);
    setLoading(true);
    try {
      const fresh = await fetchForRange(next);
      setData(fresh);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-3.5 w-3.5 text-[var(--color-muted)]" aria-hidden />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Pipeline Analytics
        </span>
      </div>
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <p className="text-sm text-[var(--color-muted)]">
            Where every candidate sits in your pipeline right now.
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-3 text-sm font-medium text-[var(--color-ink)] disabled:opacity-60"
                  disabled={loading}
                />
              }
            >
              <span>{RANGE_LABEL[range]}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
                <DropdownMenuItem key={r} onClick={() => changeRange(r)}>
                  {RANGE_LABEL[r]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-4">
          <MetricCell label="Active Jobs" value={data.activeJobs} dot="muted" tip="Jobs currently published and accepting applications." />
          <MetricCell label="Total Apps" value={data.totalApps} dot="muted" tip="Applications received in the selected range, across all your jobs." />
          <MetricCell
            label="Pending Review"
            value={data.pendingReview}
            dot={data.pendingReview > 0 ? "amber" : "muted"}
            tip="Applications still in 'applied' status — not yet screened."
          />
          <MetricCell label="In Interview" value={data.inInterview} dot="info" tip="Candidates scheduled for or completed interviews." />
        </div>

        <div className="my-4 border-t border-[var(--color-hairline-soft)]" />

        <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-4">
          <MetricCell label="Offered" value={data.offered} dot="muted" tip="Candidates with an active offer extended." />
          <MetricCell label="Hired" value={data.hired} dot="success" tip="Candidates whose application reached 'hired' status." />
          <MetricCell
            label="Avg Match Score"
            value={data.avgMatchScore}
            dot={scoreBand(data.avgMatchScore)}
            tip="Mean of overall match scores across all your applications, 0–100."
          />
          <MetricCell
            label="Bias Flags"
            value={data.biasFlags}
            dot={data.biasFlags > 0 ? "amber" : "muted"}
            tip="Job descriptions flagged by the bias detector that you have not resolved."
          />
        </div>

        <div className="-mx-6 mt-6 border-t border-[var(--color-hairline-soft)]" />
        <div className="mt-4 text-center">
          <a
            href="/recruiter/applications"
            className="text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            View applications →
          </a>
        </div>
      </div>
    </section>
  );
}

type DotKind = "muted" | "amber" | "info" | "success" | "low" | "mid" | "high";

function scoreBand(score: number): "low" | "mid" | "high" {
  if (score < 40) return "low";
  if (score < 70) return "mid";
  return "high";
}

const DOT_CLASS: Record<DotKind, string> = {
  muted: "bg-[var(--color-muted)]",
  amber: "bg-[var(--color-status-warning)]",
  info: "bg-[var(--color-status-info)]",
  success: "bg-[var(--color-status-success)]",
  low: "bg-[var(--color-score-low)]",
  mid: "bg-[var(--color-score-mid)]",
  high: "bg-[var(--color-score-high)]",
};

function MetricCell({
  label,
  value,
  dot,
  tip,
}: {
  label: string;
  value: number;
  dot: DotKind;
  tip: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${DOT_CLASS[dot]}`} aria-hidden />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </span>
        <span title={tip} className="cursor-help">
          <Info className="h-3 w-3 text-[var(--color-muted)]" aria-hidden />
        </span>
      </div>
      <div className="mt-1 font-mono text-lg font-medium text-[var(--color-ink)]">
        {value}
      </div>
    </div>
  );
}
