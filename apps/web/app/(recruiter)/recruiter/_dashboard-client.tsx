"use client";

import { useState } from "react";
import {
  ChevronDown,
  Briefcase,
  Inbox,
  Clock,
  Sparkles,
} from "lucide-react";
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

export interface KpiData {
  activeJobs: number;
  totalApps: number;
  pendingReview: number;
  avgMatchScore: number;
}

interface KpiHeroRowProps {
  initialRange: Range;
  initialData: KpiData;
  fetchForRange: (range: Range) => Promise<KpiData>;
}

export function KpiHeroRow({
  initialRange,
  initialData,
  fetchForRange,
}: KpiHeroRowProps) {
  const [range, setRange] = useState<Range>(initialRange);
  const [data, setData] = useState<KpiData>(initialData);
  const [loading, setLoading] = useState(false);

  async function changeRange(next: Range) {
    setLoading(true);
    try {
      const fresh = await fetchForRange(next);
      setRange(next);
      setData(fresh);
    } catch {
      // Silently fall back — initial data stays. A toast helper could be
      // added here in a follow-up; the existing project pattern uses
      // @/lib/toast for user-visible failures.
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-end">
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Active Jobs"
          value={data.activeJobs}
          icon={Briefcase}
          description="Currently published"
        />
        <KpiTile
          label="Total Applications"
          value={data.totalApps}
          icon={Inbox}
          description={RANGE_LABEL[range]}
        />
        <KpiTile
          label="Pending Review"
          value={data.pendingReview}
          icon={Clock}
          description="Need attention"
          tone={data.pendingReview > 0 ? "warn" : "neutral"}
        />
        <KpiTile
          label="Avg Match Score"
          value={data.avgMatchScore}
          icon={Sparkles}
          description="Across all apps"
          tone="score"
        />
      </div>
    </section>
  );
}

function KpiTile({
  label,
  value,
  icon: Icon,
  description,
  tone = "neutral",
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  tone?: "neutral" | "warn" | "score";
}) {
  let valueClass = "text-[var(--color-ink)]";
  if (tone === "score") {
    if (value === 0) valueClass = "text-[var(--color-muted)]";
    else if (value < 40) valueClass = "text-[var(--color-score-low)]";
    else if (value < 70) valueClass = "text-[var(--color-score-mid)]";
    else valueClass = "text-[var(--color-score-high)]";
  } else if (tone === "warn") {
    valueClass = "text-[var(--color-status-warning)]";
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </span>
        <Icon className="h-4 w-4 text-[var(--color-muted)]" aria-hidden />
      </div>
      <div className={`mt-3 font-mono text-3xl font-medium ${valueClass}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">{description}</div>
    </div>
  );
}
