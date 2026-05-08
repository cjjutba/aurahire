import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DateRangeClient } from "../analytics/_date-range-client";
import { KpiTileWithTooltip } from "./_kpi-tile-with-tooltip";
import { FlagBreakdownChartClient } from "./_flag-breakdown-chart-client";
import { TopTermsTable } from "./_top-terms-table";
import { ScoreDistributionAuditClient } from "./_score-distribution-audit-client";
import { RecentOverridesList } from "./_recent-overrides-list";
import { BiasMonitorRealtimeClient } from "./_bias-monitor-realtime-client";
import { ScoringQualityPanel } from "./_scoring-quality-panel";

export const metadata = { title: "Bias & Fairness Monitor" };

interface PageProps {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}

interface BundleBody {
  data: {
    range: { from: string; to: string };
    kpis: {
      totalFlags: number;
      flagsPerJob: number;
      flagsResolvedPct: number;
      overrideRate: number;
    };
    flagsByCategory: Array<{ category: string; count: number; pct: number }>;
    topFlaggedTerms: Array<{
      term: string;
      count: number;
      exampleJobIds: string[];
    }>;
    scoreDistributionByBand: Array<{
      band: "strong" | "partial" | "limited";
      count: number;
      pct: number;
    }>;
    recentOverrides: Array<{
      flagId: string;
      term: string;
      category: string;
      jobId: string;
      jobTitle: string;
      overriddenBy: { id: string; fullName: string } | null;
      overrideReason: string;
      overriddenAt: string;
    }>;
    sampleSize: { flags: number; scores: number; jobs: number };
    scoringQuality: {
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
    };
  };
}

export default async function BiasMonitorPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const params = new URLSearchParams();
  if (sp.dateFrom) params.set("dateFrom", sp.dateFrom);
  if (sp.dateTo) params.set("dateTo", sp.dateTo);

  const res = await fetch(
    `${apiUrl}/api/v1/admin/bias-monitor?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    return (
      <div className="text-[var(--color-status-danger)]">
        Failed to load bias monitor.
      </div>
    );
  }
  const body = (await res.json()) as BundleBody;
  const d = body.data;

  return (
    <TooltipProvider delay={150}>
      <div className="mx-auto max-w-[1280px] space-y-8">
        <BiasMonitorRealtimeClient />
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
              Bias &amp; Fairness Monitor
            </h1>
            <p className="mt-1 text-sm text-[var(--color-body)]">
              Aggregate oversight of biased-language detection on job postings —
              see what the system caught, what it let through with
              justification, and how recruiters used the override flow.
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Period: {new Date(d.range.from).toLocaleDateString()} →{" "}
              {new Date(d.range.to).toLocaleDateString()} ·{" "}
              <span className="font-mono">{d.sampleSize.flags}</span> flag
              {d.sampleSize.flags === 1 ? "" : "s"} ·{" "}
              <span className="font-mono">{d.sampleSize.scores}</span> match
              score{d.sampleSize.scores === 1 ? "" : "s"} ·{" "}
              <span className="font-mono">{d.sampleSize.jobs}</span> published
              job{d.sampleSize.jobs === 1 ? "" : "s"}
            </p>
          </div>
          <DateRangeClient initialFrom={sp.dateFrom} initialTo={sp.dateTo} />
        </header>

        {/* KPI tiles */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTileWithTooltip
            label="Total Flags"
            value={d.kpis.totalFlags}
            tooltip="Count of bias_flags rows created in this period (any status — flagged, overridden, or resolved)."
          />
          <KpiTileWithTooltip
            label="Flags Per Job"
            value={d.kpis.flagsPerJob}
            tooltip="Total flags ÷ number of published jobs in the period. Higher means recruiters routinely write descriptions the AI flags. Lower means clean descriptions or few jobs posted."
          />
          <KpiTileWithTooltip
            label="Resolved %"
            value={`${d.kpis.flagsResolvedPct}%`}
            tooltip="Resolved flags (recruiter edited the description after the flag) ÷ total flags. Excludes flags still 'flagged' (publish was abandoned, not addressed)."
          />
          <KpiTileWithTooltip
            label="Override Rate"
            value={`${d.kpis.overrideRate}%`}
            tooltip="Overridden flags ÷ (overridden + resolved) flags. Higher rate may indicate the AI is over-flagging or that the team is justifying decisions rather than editing them. Inspect Recent Overrides below to see specific cases."
          />
        </div>

        {/* Charts row */}
        <div className="grid gap-4 lg:grid-cols-2">
          <FlagBreakdownChartClient data={d.flagsByCategory} />
          <ScoreDistributionAuditClient
            data={d.scoreDistributionByBand}
            sampleSize={d.sampleSize.scores}
          />
        </div>

        {/* Top terms */}
        <TopTermsTable terms={d.topFlaggedTerms} />

        {/* Recent overrides */}
        <RecentOverridesList overrides={d.recentOverrides} />

        {/* Scoring quality (calibration warnings) */}
        <ScoringQualityPanel
          totalWarnings={d.scoringQuality.totalWarnings}
          byReason={d.scoringQuality.byReason}
          byComponent={d.scoringQuality.byComponent}
          recent={d.scoringQuality.recent}
        />

        {/* Honesty footer */}
        <p className="rounded-[var(--radius-lg)] bg-[var(--color-surface-soft)] p-4 text-xs text-[var(--color-muted)]">
          <strong className="text-[var(--color-body)]">
            A note on fairness analysis:
          </strong>{" "}
          This view surfaces aggregate flag counts + override decisions. It does
          NOT compute disparate-impact tests against demographic groups — by
          design, the system does not collect protected-class data (PII
          redaction, see <code className="rounded bg-[var(--color-canvas)] px-1 font-mono">/admin/ai-config</code>
          ). For the methodology, see{" "}
          <code className="rounded bg-[var(--color-canvas)] px-1 font-mono">
            docs/main/ai-design.md
          </code>{" "}
          § &ldquo;Aggregate Fairness Monitoring.&rdquo;
        </p>
      </div>
    </TooltipProvider>
  );
}
