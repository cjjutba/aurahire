import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, FileText, ShieldX } from "lucide-react";
import { AUTO_REJECT_THRESHOLD } from "@aurahire/shared";

import { getCurrentSession } from "@/lib/auth/session";
import { ApplyFormClient } from "./_apply-form-client";
import type { ApplyMatchPreview } from "@/components/score/apply-match-summary";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Apply to Job" };

interface JobRecap {
  id: string;
  title: string;
  employmentType: string;
  workMode: string;
  experienceLevel: string;
  locationCity: string | null;
  locationRegion: string | null;
  locationCountry: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  applicationDeadline: string | null;
  company: { name: string; logoUrl?: string | null };
}

interface ResumeRow {
  id: string;
  filename: string;
  isDefault: boolean;
  parseStatus: string;
  sizeBytes: number;
  createdAt: string;
}

export default async function ApplyPage({ params }: PageProps) {
  const { id: jobId } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const authHeaders = { Authorization: `Bearer ${session.access_token}` };

  const [jobRes, resumesRes, appsRes, previewRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/jobs/${jobId}/for-candidate`, {
      headers: authHeaders,
      cache: "no-store",
    }),
    fetch(`${apiUrl}/api/v1/resumes/mine`, {
      headers: authHeaders,
      cache: "no-store",
    }),
    fetch(`${apiUrl}/api/v1/applications/mine`, {
      headers: authHeaders,
      cache: "no-store",
    }),
    fetch(`${apiUrl}/api/v1/scoring/match-preview/${jobId}`, {
      headers: authHeaders,
      cache: "no-store",
    }),
  ]);

  if (jobRes.status === 404) notFound();
  if (!jobRes.ok || !resumesRes.ok) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <p className="text-sm text-[var(--color-status-danger)]">
          Failed to load. Please refresh the page.
        </p>
      </div>
    );
  }

  // Hard block: if the candidate already applied to this job, redirect to
  // the existing application instead of letting them open the form again.
  if (appsRes.ok) {
    const appsBody = (await appsRes.json()) as {
      data: Array<{ id: string; jobId: string }>;
    };
    const existing = appsBody.data.find((a) => a.jobId === jobId);
    if (existing) redirect(`/candidate/applications/${existing.id}`);
  }

  const jobBody = (await jobRes.json()) as { data: JobRecap };
  const resumesBody = (await resumesRes.json()) as { data: ResumeRow[] };

  const job = jobBody.data;
  const parsedResumes = resumesBody.data.filter(
    (r) => r.parseStatus === "parsed",
  );

  let preview: ApplyMatchPreview | null = null;
  if (previewRes.ok) {
    const previewBody = (await previewRes.json()) as {
      data: ApplyMatchPreview | null;
    };
    preview = previewBody.data;
  }

  // Per thesis panel revision (May 2026): hard block on opening the
  // apply form when the candidate has already computed a preview that
  // falls below the auto-reject threshold. The server-side guard on
  // POST /applications enforces the same rule for direct API calls;
  // this is the user-facing version that explains *why* before the
  // candidate fills out a form they can't submit.
  if (preview && preview.overallScore < AUTO_REJECT_THRESHOLD) {
    return (
      <BelowThresholdBlocked
        jobId={jobId}
        jobTitle={job.title}
        companyName={job.company.name}
        score={preview.overallScore}
        threshold={AUTO_REJECT_THRESHOLD}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 pb-24 lg:pb-6">
      {/* Back link */}
      <Link
        href={`/candidate/jobs/${jobId}`}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to job detail
      </Link>

      {/* Header */}
      <header className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Apply to position
        </p>
        <h1 className="mt-1.5 text-2xl font-normal leading-tight tracking-tight text-[var(--color-ink)] sm:text-3xl">
          {job.title}
        </h1>
        <p className="mt-1.5 text-sm font-medium text-[var(--color-body)]">
          at {job.company.name}
        </p>
      </header>

      {/* Two-column body */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main column, form OR no-resume state */}
        <div className="space-y-6">
          {parsedResumes.length === 0 ? (
            <NoResumesCard />
          ) : (
            <ApplyFormClient
              jobId={jobId}
              resumes={parsedResumes}
              preview={preview}
            />
          )}
        </div>

        {/* Right rail */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
          {/* Recap */}
          <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              You&apos;re applying to
            </h2>
            <div className="mt-4 flex items-start gap-3">
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
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
                  {job.title}
                </p>
                <p className="truncate text-xs text-[var(--color-muted)]">
                  {job.company.name}
                </p>
              </div>
            </div>

            <dl className="mt-5 space-y-3 border-t border-[var(--color-hairline-soft)] pt-4 text-xs">
              <RecapFact label="Employment">
                <span className="capitalize">{job.employmentType}</span>
                <span className="text-[var(--color-muted)]"> · </span>
                <span className="capitalize">{job.workMode}</span>
              </RecapFact>
              <RecapFact label="Experience">
                <span className="capitalize">{job.experienceLevel}</span>
              </RecapFact>
              {(job.locationCity || job.locationCountry) && (
                <RecapFact label="Location">
                  {[job.locationCity, job.locationRegion, job.locationCountry]
                    .filter(Boolean)
                    .join(", ")}
                </RecapFact>
              )}
              {job.salaryMin !== null && job.salaryMax !== null && (
                <RecapFact label="Salary">
                  <span className="font-mono text-[var(--color-ink)]">
                    {job.salaryMin.toLocaleString()}-
                    {job.salaryMax.toLocaleString()}{" "}
                    <span className="text-[var(--color-muted)]">
                      {job.salaryCurrency}
                    </span>
                  </span>
                </RecapFact>
              )}
              {job.applicationDeadline && (
                <RecapFact label="Apply by">
                  <span className="font-mono">
                    {formatDate(job.applicationDeadline)}
                  </span>
                </RecapFact>
              )}
            </dl>
          </section>

          {/* What happens next */}
          <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              What happens next
            </h2>
            <ol className="mt-4 space-y-3 text-xs">
              <NextStep n={1}>
                Your resume is matched against the role&apos;s required skills
                with a transparent breakdown.
              </NextStep>
              <NextStep n={2}>
                The recruiter reviews your application and reaches out if
                there&apos;s a fit.
              </NextStep>
              <NextStep n={3}>
                You can track the application&apos;s status anytime from{" "}
                <Link
                  href="/candidate/applications"
                  className="font-medium text-[var(--color-primary)] underline-offset-2 hover:underline"
                >
                  My applications
                </Link>
                .
              </NextStep>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function RecapFact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-start gap-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </dt>
      <dd className="text-[var(--color-body)]">{children}</dd>
    </div>
  );
}

function NextStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-primary-soft)] font-mono text-[10px] font-semibold text-[var(--color-primary)]">
        {n}
      </span>
      <span className="text-[var(--color-body)]">{children}</span>
    </li>
  );
}

/**
 * Server-side "you can't apply" page rendered in place of the apply
 * form when the candidate's preview match score for this job is below
 * the auto-reject threshold. Per thesis panel revision (May 2026), this
 * is a hard gate, not a warning - the candidate has to either update
 * their resume + recompute the preview, or skip this role.
 */
function BelowThresholdBlocked({
  jobId,
  jobTitle,
  companyName,
  score,
  threshold,
}: {
  jobId: string;
  jobTitle: string;
  companyName: string;
  score: number;
  threshold: number;
}) {
  return (
    <div className="mx-auto max-w-[720px] space-y-6 pb-24 lg:pb-6">
      <Link
        href={`/candidate/jobs/${jobId}`}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to job detail
      </Link>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-score-mid)] bg-[var(--color-score-mid-soft)]/40 p-8">
        <div className="flex items-start gap-4">
          <div
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-score-mid-soft)] text-[var(--color-score-mid)]"
          >
            <ShieldX className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
              You can&apos;t apply to this role yet
            </h1>
            <p className="mt-3 text-sm text-[var(--color-body)]">
              Your match score for{" "}
              <span className="font-medium text-[var(--color-ink)]">
                {jobTitle}
              </span>{" "}
              at{" "}
              <span className="font-medium text-[var(--color-ink)]">
                {companyName}
              </span>{" "}
              is{" "}
              <span className="font-mono font-semibold text-[var(--color-ink)]">
                {score}
              </span>{" "}
              / 100. This role requires a minimum match of{" "}
              <span className="font-mono font-semibold text-[var(--color-ink)]">
                {threshold}
              </span>{" "}
              / 100 for an interview, so applications below the threshold
              are blocked at submission.
            </p>
            <p className="mt-3 text-sm text-[var(--color-muted)]">
              To improve your match, update your resume to highlight the
              skills and experience this role calls out, then recompute
              your preview from the job page.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/candidate/jobs/${jobId}`}
          className="inline-flex h-11 items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
        >
          Back to the job
        </Link>
        <Link
          href="/candidate/resume"
          className="inline-flex h-11 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-soft)]"
        >
          Update my resume
        </Link>
        <Link
          href="/candidate/jobs"
          className="inline-flex h-11 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-soft)]"
        >
          Find another role
        </Link>
      </div>
    </div>
  );
}

function NoResumesCard() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <div
        aria-hidden
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-surface-strong)] text-[var(--color-muted)]"
      >
        <FileText className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-[var(--color-ink)]">
        No parsed resumes yet
      </h2>
      <p className="mt-1.5 text-sm text-[var(--color-body)]">
        Upload a resume to start applying. We&apos;ll parse it before you
        submit.
      </p>
      <Link
        href="/candidate/resume"
        className="mt-5 inline-flex h-11 items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
      >
        Upload a resume
      </Link>
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
