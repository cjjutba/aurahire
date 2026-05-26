import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Check,
  GraduationCap,
  MapPin,
  Sparkles,
  Wallet,
} from "lucide-react";
import type { JobStatus } from "@aurahire/shared";

import { RichTextContent } from "@/components/jobs/rich-text-content";

import { MatchPreviewClient } from "./_match-preview-client";
import { ApplyCtaClient } from "./_apply-cta-client";

interface CandidateJobDetail {
  id: string;
  title: string;
  department: string | null;
  employmentType: string;
  workMode: string;
  locationCity: string | null;
  locationRegion: string | null;
  locationCountry: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  description: string;
  requiredSkills: string[];
  experienceLevel: string;
  educationRequirement: string | null;
  applicationDeadline: string | null;
  status: JobStatus;
  publishedAt: string | null;
  company: { name: string; logoUrl?: string | null };
}

interface CandidateJobDetailViewProps {
  job: CandidateJobDetail;
  applyHref: string;
  existingApplicationId?: string | null;
}

export function CandidateJobDetailView({
  job,
  applyHref,
  existingApplicationId,
}: CandidateJobDetailViewProps) {
  const location = [job.locationCity, job.locationRegion, job.locationCountry]
    .filter(Boolean)
    .join(", ");
  const hasSalary = job.salaryMin !== null && job.salaryMax !== null;
  const hasEducation =
    !!job.educationRequirement && job.educationRequirement !== "none";
  const showHeaderTagline = !!(job.department || hasEducation);
  const hasApplied = !!existingApplicationId;
  const viewApplicationHref = `/candidate/applications/${existingApplicationId ?? ""}`;

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 pb-24 lg:pb-6">
      {/* Back link */}
      <Link
        href="/candidate/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to jobs
      </Link>

      {/* Header */}
      <header className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 sm:p-8">
        <div className="flex flex-wrap items-start gap-5">
          {job.company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={job.company.logoUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-[var(--radius-md)] object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-strong)] text-[var(--color-muted)]"
            >
              <Building2 className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-normal leading-tight tracking-tight text-[var(--color-ink)] sm:text-3xl">
              {job.title}
            </h1>
            <p className="mt-1.5 text-sm font-medium text-[var(--color-body)]">
              {job.company.name}
              {showHeaderTagline && job.department
                ? ` · ${job.department}`
                : ""}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Pill icon={Briefcase} label={job.employmentType} />
              <Pill label={job.workMode} />
              <Pill label={job.experienceLevel} />
              {hasApplied && (
                <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-score-high-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-status-success)]">
                  <Check className="h-3 w-3" />
                  Applied
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Two-column body */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main column */}
        <div className="space-y-6">
          {/* See-my-match preview, surfaces auto-precomputed score
              instantly, otherwise lets candidate trigger one click. */}
          <MatchPreviewClient jobId={job.id} hidden={hasApplied} />

          {job.requiredSkills.length > 0 && (
            <Card>
              <SectionLabel>Required Skills</SectionLabel>
              <div className="mt-3 flex flex-wrap gap-2">
                {job.requiredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <SectionLabel>About this role</SectionLabel>
            <RichTextContent html={job.description} className="mt-4" />
          </Card>

          {hasEducation && (
            <Card>
              <SectionLabel>Education</SectionLabel>
              <p className="mt-2 inline-flex items-center gap-2 text-sm text-[var(--color-body)]">
                <GraduationCap className="h-4 w-4 text-[var(--color-muted)]" />
                <span className="capitalize">{job.educationRequirement}</span>
                <span className="text-[var(--color-muted)]">or equivalent</span>
              </p>
            </Card>
          )}
        </div>

        {/* Right rail */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
          {/* Apply card (hidden on mobile, replaced by sticky bottom bar).
              Per thesis panel revision (May 2026): the Apply CTA is
              disabled when the preview match score is below the
              auto-reject threshold (default 75). The shared client
              component reads the preview from the same query the
              <MatchPreviewClient /> consumes — no duplicate fetch, no
              prop drilling. */}
          <div className="hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5 shadow-[0_4px_12px_rgba(0,0,0,0.04)] lg:block">
            {hasApplied && (
              <div className="mb-3 flex items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-score-high-soft)] py-2.5 text-sm font-semibold text-[var(--color-status-success)]">
                <Check className="h-4 w-4" />
                You applied
              </div>
            )}
            <ApplyCtaClient
              jobId={job.id}
              hasApplied={hasApplied}
              applyHref={applyHref}
              viewApplicationHref={viewApplicationHref}
              variant="card"
            />
            {job.publishedAt && (
              <p className="mt-3 text-center text-xs text-[var(--color-muted)]">
                Posted{" "}
                <span className="font-mono">
                  {relativeDate(job.publishedAt)}
                </span>
              </p>
            )}
          </div>

          {/* Key facts */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
            <SectionLabel>Job overview</SectionLabel>
            <dl className="mt-4 space-y-3.5 text-sm">
              {location && (
                <Fact icon={MapPin} label="Location" value={location} />
              )}
              {hasSalary && (
                <Fact
                  icon={Wallet}
                  label="Salary"
                  value={
                    <span className="font-mono text-[var(--color-ink)]">
                      {job.salaryMin!.toLocaleString()}-
                      {job.salaryMax!.toLocaleString()}{" "}
                      <span className="text-[var(--color-muted)]">
                        {job.salaryCurrency}
                      </span>
                    </span>
                  }
                />
              )}
              <Fact
                icon={Briefcase}
                label="Employment"
                value={<span className="capitalize">{job.employmentType}</span>}
              />
              <Fact
                icon={Sparkles}
                label="Experience"
                value={
                  <span className="capitalize">{job.experienceLevel}</span>
                }
              />
              {job.applicationDeadline && (
                <Fact
                  icon={Calendar}
                  label="Apply by"
                  value={
                    <span className="font-mono">
                      {formatDate(job.applicationDeadline)}
                    </span>
                  }
                />
              )}
            </dl>
          </div>

          {/* Company card */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
            <SectionLabel>About the company</SectionLabel>
            <div className="mt-4 flex items-center gap-3">
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
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                {job.company.name}
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile sticky apply bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-hairline)] bg-[var(--color-canvas)]/95 px-4 py-3 backdrop-blur lg:hidden">
        <ApplyCtaClient
          jobId={job.id}
          hasApplied={hasApplied}
          applyHref={applyHref}
          viewApplicationHref={viewApplicationHref}
          variant="sticky"
        />
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
      {children}
    </h2>
  );
}

function Pill({
  icon: Icon,
  label,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-3 py-1 text-xs font-medium capitalize text-[var(--color-ink)]">
      {Icon && <Icon className="h-3 w-3 text-[var(--color-muted)]" />}
      {label}
    </span>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-muted)]" />
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </dt>
        <dd className="mt-0.5 text-sm text-[var(--color-body)]">{value}</dd>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function relativeDate(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
