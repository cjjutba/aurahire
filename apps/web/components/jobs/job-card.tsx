import Link from "next/link";
import { MapPin, Briefcase, Building2, Check } from "lucide-react";
import type { JobStatus } from "@aurahire/shared";
import { JobStatusChip } from "./job-status-chip";
import { MatchBandChip } from "@/components/score/match-band-chip";

/**
 * Map a numeric match score (0–100) to the CSS variables used to render the
 * progress bar fill + track. Mirrors the band thresholds the dashboard's
 * RecommendedJobCard uses (>= 70 → high, >= 40 → mid, else low).
 */
export function matchScoreColors(overallScore: number): {
  fill: string;
  track: string;
} {
  const ratio = overallScore / 100;
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

interface JobCardProps {
  job: {
    id: string;
    title: string;
    department: string | null;
    employmentType: string;
    workMode: string;
    locationCity: string | null;
    locationCountry: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryCurrency: string;
    status: JobStatus;
    publishedAt: string | null;
    company: { name: string; logoUrl?: string | null };
  };
  href: string;
  showStatus?: boolean;
  applied?: boolean;
  /** Precomputed match preview for this candidate against this job. */
  matchPreview?: {
    overallScore: number;
    band: "strong" | "partial" | "limited";
  };
  /**
   * When true and `matchPreview` is absent, the score row renders a thin
   * skeleton bar so the card height stays stable while previews resolve.
   */
  matchPreviewLoading?: boolean;
}

export function JobCard({
  job,
  href,
  showStatus,
  applied,
  matchPreview,
  matchPreviewLoading,
}: JobCardProps) {
  const location = [job.locationCity, job.locationCountry].filter(Boolean).join(", ");
  const hasSalary = job.salaryMin !== null && job.salaryMax !== null;

  return (
    <Link
      href={href}
      className="group flex h-full flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--color-primary-soft)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)]"
    >
      {/* Header: logo + company + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {job.company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={job.company.logoUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded-[var(--radius-sm)] object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-strong)] text-[var(--color-muted)]"
            >
              <Building2 className="h-5 w-5" />
            </div>
          )}
          <p className="truncate text-sm font-medium text-[var(--color-body)]">
            {job.company.name}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {applied && (
            <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-score-high-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-status-success)]">
              <Check className="h-2.5 w-2.5" />
              Applied
            </span>
          )}
          {showStatus && <JobStatusChip status={job.status} />}
        </div>
      </div>

      {/* Title + department */}
      <div className="min-h-[3.25rem]">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-[var(--color-ink)] group-hover:text-[var(--color-primary)]">
          {job.title}
        </h3>
        {job.department && (
          <p className="mt-1 truncate text-xs text-[var(--color-muted)]">{job.department}</p>
        )}
      </div>

      {/* Meta chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2.5 py-1 text-[11px] font-medium capitalize text-[var(--color-ink)]">
          <Briefcase className="h-3 w-3 text-[var(--color-muted)]" />
          {job.employmentType}
        </span>
        <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2.5 py-1 text-[11px] font-medium capitalize text-[var(--color-ink)]">
          {job.workMode}
        </span>
      </div>

      {/* Match score row — only on candidate-facing usage that passes matchPreview */}
      {matchPreview ? (
        <div className="flex items-center gap-3">
          <MatchBandChip band={matchPreview.band} />
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-[var(--radius-pill)]"
            style={{ backgroundColor: matchScoreColors(matchPreview.overallScore).track }}
          >
            <div
              data-testid="job-card-match-fill"
              className="h-full rounded-[var(--radius-pill)]"
              style={{
                width: `${matchPreview.overallScore}%`,
                backgroundColor: matchScoreColors(matchPreview.overallScore).fill,
              }}
            />
          </div>
          <span className="font-mono text-xs text-[var(--color-ink)]">
            {matchPreview.overallScore}
            <span className="text-[var(--color-muted)]"> / 100</span>
          </span>
        </div>
      ) : matchPreviewLoading ? (
        <div
          data-testid="job-card-match-skeleton"
          aria-hidden
          className="h-1.5 w-full animate-pulse rounded-[var(--radius-pill)] bg-[var(--color-surface-soft)]"
        />
      ) : null}

      {/* Footer: location + salary */}
      <div className="mt-auto space-y-1.5 border-t border-[var(--color-hairline-soft)] pt-4 text-xs">
        {location && (
          <div className="flex items-center gap-1.5 text-[var(--color-body)]">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted)]" />
            <span className="truncate">{location}</span>
          </div>
        )}
        {hasSalary ? (
          <div className="font-mono text-[var(--color-ink)]">
            {job.salaryMin!.toLocaleString()}–{job.salaryMax!.toLocaleString()}{" "}
            <span className="text-[var(--color-muted)]">{job.salaryCurrency}</span>
          </div>
        ) : (
          <div className="text-[var(--color-muted)]">Salary not disclosed</div>
        )}
      </div>
    </Link>
  );
}
