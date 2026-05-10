import { redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentSession } from "@/lib/auth/session";

import { JobsTableClient } from "./_jobs-table-client";
import { JobsToolbarClient } from "./_jobs-toolbar-client";
import { JobsPagination } from "./_jobs-pagination";

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

function biasUiValue(raw: string | undefined): "all" | "flagged" | "clean" {
  if (raw === "true") return "flagged";
  if (raw === "false") return "clean";
  return "all";
}

export default async function JobsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const params = new URLSearchParams();
  if (sp.status) params.set("status", sp.status);
  if (sp.recruiterId) params.set("recruiterId", sp.recruiterId);
  if (sp.hasBiasFlags) params.set("hasBiasFlags", sp.hasBiasFlags);
  if (sp.q) params.set("q", sp.q);
  if (sp.page) params.set("page", sp.page);
  params.set("limit", "20");

  const res = await fetch(`${apiUrl}/api/v1/admin/jobs?${params.toString()}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <p className="text-sm text-[var(--color-status-danger)]">
          Failed to load jobs.
        </p>
      </div>
    );
  }
  const body = (await res.json()) as ListBody;

  const filtersActive = !!(
    sp.q ||
    sp.status ||
    sp.hasBiasFlags ||
    sp.recruiterId
  );

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <header>
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          Job Moderation
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          {body.meta.total === 0
            ? "No jobs to moderate yet"
            : `${body.meta.total} job${body.meta.total === 1 ? "" : "s"}`}
        </p>
      </header>

      <JobsToolbarClient
        initialQuery={sp.q ?? ""}
        status={sp.status ?? "all"}
        bias={biasUiValue(sp.hasBiasFlags)}
      />

      {body.data.length === 0 ? (
        filtersActive ? (
          <EmptyFiltered />
        ) : (
          <EmptyJobs />
        )
      ) : (
        <>
          <JobsTableClient rows={body.data} />
          <JobsPagination
            meta={body.meta}
            searchParams={{
              q: sp.q,
              status: sp.status,
              hasBiasFlags: sp.hasBiasFlags,
              recruiterId: sp.recruiterId,
            }}
          />
        </>
      )}
    </div>
  );
}

function EmptyJobs() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No jobs to moderate yet
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        Recruiter-published jobs appear here once they&rsquo;re live.
      </div>
    </div>
  );
}

function EmptyFiltered() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No jobs match your filters
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        Try different search terms or clear the filters.
      </div>
      <Link
        href="/admin/jobs"
        className="mt-4 inline-flex h-9 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
      >
        Clear filters
      </Link>
    </div>
  );
}
