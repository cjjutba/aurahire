import {
  Briefcase,
  MapPin,
  Calendar,
  DollarSign,
  Building2,
} from "lucide-react";
import type { JobStatus } from "@aurahire/shared";
import { JobStatusChip } from "./job-status-chip";

interface JobDetailProps {
  job: {
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
  };
  showStatusChip?: boolean;
  actions?: React.ReactNode;
}

export function JobDetail({ job, showStatusChip, actions }: JobDetailProps) {
  return (
    <article className="space-y-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
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
            <div>
              <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
                {job.title}
              </h1>
              <p className="mt-1 text-base font-medium text-[var(--color-body)]">
                {job.company.name}
                {job.department ? ` · ${job.department}` : ""}
              </p>
            </div>
          </div>
          {actions}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {showStatusChip && <JobStatusChip status={job.status} />}
          <Meta
            icon={Briefcase}
            text={`${job.employmentType} · ${job.workMode} · ${job.experienceLevel}`}
          />
          {(job.locationCity || job.locationCountry) && (
            <Meta
              icon={MapPin}
              text={[job.locationCity, job.locationRegion, job.locationCountry]
                .filter(Boolean)
                .join(", ")}
            />
          )}
          {job.salaryMin !== null && job.salaryMax !== null && (
            <Meta
              icon={DollarSign}
              text={`${job.salaryMin.toLocaleString()}-${job.salaryMax.toLocaleString()} ${job.salaryCurrency}`}
            />
          )}
          {job.applicationDeadline && (
            <Meta
              icon={Calendar}
              text={`Apply by ${new Date(job.applicationDeadline).toLocaleDateString()}`}
            />
          )}
        </div>
      </header>

      {job.requiredSkills.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Required Skills
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {job.requiredSkills.map((skill) => (
              <span
                key={skill}
                className="rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)]"
              >
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          About this role
        </h2>
        <div
          className="prose prose-sm mt-3 max-w-none text-[var(--color-body)]"
          dangerouslySetInnerHTML={{ __html: job.description }}
        />
      </section>

      {job.educationRequirement && job.educationRequirement !== "none" && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Education
          </h2>
          <p className="mt-2 text-sm text-[var(--color-body)]">
            {job.educationRequirement} or equivalent
          </p>
        </section>
      )}
    </article>
  );
}

function Meta({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)]">
      <Icon className="h-4 w-4" />
      {text}
    </span>
  );
}
