import type { JobStatus } from "@aurahire/shared";
import { JobListRow } from "@/components/jobs/job-list-row";
import { JobFilters } from "@/components/jobs/job-filters";
import { EmptyState } from "@/components/empty-state";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    mode?: string;
    experienceLevel?: string;
    page?: string;
  }>;
}

interface PublicJobRow {
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
  company: { name: string; logoUrl: string | null };
}

export const metadata = { title: "Browse Jobs" };

export default async function PublicJobsPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const url = new URL(`${apiUrl}/api/v1/jobs`);
  if (sp.q) url.searchParams.set("q", sp.q);
  if (sp.mode) url.searchParams.set("mode", sp.mode);
  if (sp.experienceLevel)
    url.searchParams.set("experienceLevel", sp.experienceLevel);
  if (sp.page) url.searchParams.set("page", sp.page);

  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json()) as {
    data: PublicJobRow[];
    meta: { total: number };
  };

  return (
    <div className="mx-auto max-w-[1024px] px-6 py-12">
      <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
        Find your next role
      </h1>
      <p className="mt-2 text-sm text-[var(--color-body)]">
        {body.meta.total} jobs available
      </p>
      <div className="mt-8">
        <JobFilters />
      </div>
      <div className="mt-6 space-y-3">
        {body.data.length === 0 ? (
          <EmptyState
            headline="No jobs match your search"
            description="Try clearing your filters or browse all open roles."
            cta={{ href: "/jobs", label: "Browse all" }}
          />
        ) : (
          body.data.map((job) => (
            <JobListRow key={job.id} job={job} href={`/jobs/${job.id}`} />
          ))
        )}
      </div>
    </div>
  );
}
