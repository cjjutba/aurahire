import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { JobsTableClient } from "./_jobs-table-client";
import { FiltersClient } from "./_filters-client";

export const metadata = { title: "Job Moderation" };

interface PageProps {
  searchParams: Promise<{
    status?: string;
    recruiterId?: string;
    hasBiasFlags?: string;
    q?: string;
    page?: string;
  }>;
}

interface JobRow {
  id: string;
  title: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  recruiter: { id: string; fullName: string; email: string };
  company: { id: string; name: string };
  biasFlagsCount: number;
  applicationsCount: number;
}

interface ListBody {
  data: JobRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export default async function JobsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const params = new URLSearchParams();
  if (sp.status) params.set("status", sp.status);
  if (sp.recruiterId) params.set("recruiterId", sp.recruiterId);
  if (sp.hasBiasFlags === "true") params.set("hasBiasFlags", "true");
  if (sp.q) params.set("q", sp.q);
  if (sp.page) params.set("page", sp.page);
  params.set("limit", "20");

  const res = await fetch(`${apiUrl}/api/v1/admin/jobs?${params.toString()}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="text-[var(--color-status-danger)]">
        Failed to load jobs.
      </div>
    );
  }
  const body = (await res.json()) as ListBody;

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Job Moderation
        </h1>
        <p className="mt-1 text-sm text-[var(--color-body)]">
          {body.meta.total} job{body.meta.total === 1 ? "" : "s"}
        </p>
      </header>
      <FiltersClient
        initialFilters={{
          status: sp.status,
          q: sp.q,
          hasBiasFlags: sp.hasBiasFlags,
        }}
      />
      {body.data.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] py-16 text-center">
          <h3 className="text-lg font-semibold text-[var(--color-ink)]">
            No jobs match these filters
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-body)]">
            Try widening the filters or clearing the search.
          </p>
        </div>
      ) : (
        <JobsTableClient rows={body.data} meta={body.meta} />
      )}
    </div>
  );
}
