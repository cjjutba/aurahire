import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, FileText } from "lucide-react";
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
        {/* Main column — form OR no-resume state */}
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
                    {job.salaryMin.toLocaleString()}–
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
