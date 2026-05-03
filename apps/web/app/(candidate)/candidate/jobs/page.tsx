import { redirect } from "next/navigation";
import type { JobStatus } from "@aurahire/shared";
import { JobListRow } from "@/components/jobs/job-list-row";
import { JobFilters } from "@/components/jobs/job-filters";
import { EmptyState } from "@/components/empty-state";
import { getCurrentSession } from "@/lib/auth/session";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    mode?: string;
    experienceLevel?: string;
    page?: string;
  }>;
}

interface CandidateJobRow {
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
  company: { name: string };
}

export const metadata = { title: "Browse Jobs" };

export default async function CandidateJobsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const url = new URL(`${apiUrl}/api/v1/jobs/for-candidate`);
  if (sp.q) url.searchParams.set("q", sp.q);
  if (sp.mode) url.searchParams.set("mode", sp.mode);
  if (sp.experienceLevel)
    url.searchParams.set("experienceLevel", sp.experienceLevel);
  if (sp.page) url.searchParams.set("page", sp.page);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  const body = (await res.json()) as {
    data: CandidateJobRow[];
    meta: { total: number };
  };

  return (
    <div className="mx-auto max-w-[1024px] space-y-6">
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Browse Jobs
        </h1>
        <p className="mt-1 text-sm text-[var(--color-body)]">
          {body.meta.total} jobs · match scoring arrives in a future slice
        </p>
      </header>
      <JobFilters />
      <div className="space-y-3">
        {body.data.length === 0 ? (
          <EmptyState
            headline="No jobs match your filters yet"
            description="Try clearing your filters or browse all available roles."
            cta={{ href: "/candidate/jobs", label: "Browse all" }}
          />
        ) : (
          body.data.map((job) => (
            <JobListRow
              key={job.id}
              job={job}
              href={`/candidate/jobs/${job.id}`}
            />
          ))
        )}
      </div>
    </div>
  );
}
