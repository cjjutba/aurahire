import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { FiltersClient } from "./_filters-client";
import { ApplicationsTableClient } from "./_applications-table-client";

export const metadata = { title: "Application Oversight" };

interface PageProps {
  searchParams: Promise<{
    jobId?: string;
    status?: string;
    minScore?: string;
    maxScore?: string;
    dateFrom?: string;
    dateTo?: string;
    q?: string;
    page?: string;
  }>;
}

interface ListBody {
  data: Array<{
    id: string;
    status: string;
    appliedAt: string;
    candidate: { id: string; fullName: string; email: string };
    job: {
      id: string;
      title: string;
      companyName: string;
      recruiterName: string;
    };
    overallScore: number | null;
    band: "strong" | "partial" | "limited" | null;
    hasRedactions: boolean;
  }>;
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export default async function AdminApplicationsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const params = new URLSearchParams();
  if (sp.jobId) params.set("jobId", sp.jobId);
  if (sp.status) params.set("status", sp.status);
  if (sp.minScore) params.set("minScore", sp.minScore);
  if (sp.maxScore) params.set("maxScore", sp.maxScore);
  if (sp.dateFrom) params.set("dateFrom", sp.dateFrom);
  if (sp.dateTo) params.set("dateTo", sp.dateTo);
  if (sp.q) params.set("q", sp.q);
  if (sp.page) params.set("page", sp.page);
  params.set("limit", "20");

  const res = await fetch(
    `${apiUrl}/api/v1/admin/applications?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    return (
      <div className="text-[var(--color-status-danger)]">
        Failed to load applications.
      </div>
    );
  }
  const body = (await res.json()) as ListBody;

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Application Oversight
        </h1>
        <p className="mt-1 text-sm text-[var(--color-body)]">
          {body.meta.total} application{body.meta.total === 1 ? "" : "s"}{" "}
          system-wide
        </p>
      </header>

      <FiltersClient initialFilters={sp} />

      {body.data.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] py-16 text-center">
          <h3 className="text-lg font-semibold text-[var(--color-ink)]">
            No applications match these filters
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-body)]">
            Try widening the score range or clearing the search.
          </p>
        </div>
      ) : (
        <ApplicationsTableClient rows={body.data} meta={body.meta} />
      )}
    </div>
  );
}
