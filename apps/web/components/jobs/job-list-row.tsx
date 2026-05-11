import Link from "next/link";
import { MapPin, Briefcase, Building2 } from "lucide-react";
import type { JobStatus } from "@aurahire/shared";
import { JobStatusChip } from "./job-status-chip";

interface JobListRowProps {
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
}

export function JobListRow({ job, href, showStatus }: JobListRowProps) {
  return (
    <Link
      href={href}
      className="block rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5 transition hover:border-[var(--color-primary-soft)] hover:bg-[var(--color-surface-soft)]"
    >
      <div className="flex items-start gap-4">
        {/* Company logo / fallback */}
        {job.company.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={job.company.logoUrl}
            alt=""
            className="h-11 w-11 shrink-0 rounded-[var(--radius-sm)] object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-strong)] text-[var(--color-muted)]"
          >
            <Building2 className="h-5 w-5" />
          </div>
        )}
        <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-[var(--color-ink)]">
              {job.title}
            </h3>
            <p className="mt-1 text-sm font-medium text-[var(--color-body)]">
              {job.company.name}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
              <span className="inline-flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" />
                {job.employmentType} · {job.workMode}
              </span>
              {(job.locationCity || job.locationCountry) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {[job.locationCity, job.locationCountry]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              )}
              {job.salaryMin !== null && job.salaryMax !== null && (
                <span className="font-mono">
                  {job.salaryMin.toLocaleString()}-
                  {job.salaryMax.toLocaleString()} {job.salaryCurrency}
                </span>
              )}
            </div>
          </div>
          {showStatus && <JobStatusChip status={job.status} />}
        </div>
      </div>
    </Link>
  );
}
