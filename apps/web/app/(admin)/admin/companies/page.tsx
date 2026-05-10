import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";

import { CompaniesTableClient } from "./_companies-table-client";
import { CompaniesToolbarClient } from "./_companies-toolbar-client";
import { CompaniesPagination } from "./_companies-pagination";

export const metadata = { title: "Companies" };

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminCompanyRow {
  id: string;
  name: string;
  industry: string | null;
  size: string | null;
  website: string | null;
  logoUrl: string | null;
  headquartersLocation: string | null;
  description: string | null;
  owner: { name: string | null; email: string | null };
  memberCount: number;
  jobCount: number;
  status: "active" | "suspended";
  createdAt: string;
  updatedAt: string;
}

interface ListEnvelope {
  data: AdminCompanyRow[];
  meta: PaginationMeta;
}

interface PageProps {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
}

export default async function AdminCompaniesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const q = sp.q?.trim() ?? "";
  const page = sp.page ? Math.max(1, Number(sp.page)) : 1;
  const limit = 25;

  const apiParams = new URLSearchParams();
  if (q) apiParams.set("q", q);
  apiParams.set("page", String(page));
  apiParams.set("limit", String(limit));

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(
    `${apiUrl}/api/v1/admin/companies?${apiParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    return (
      <div className="mx-auto max-w-[1280px] space-y-6">
        <header>
          <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
            Companies
          </h1>
        </header>
        <p className="text-sm text-[var(--color-status-danger)]">
          Failed to load companies. Please refresh the page.
        </p>
      </div>
    );
  }

  const body = (await res.json()) as ListEnvelope;
  const rows = body.data;
  const meta = body.meta;
  const filtersActive = !!q;

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <header>
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          Companies
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          {meta.total === 0
            ? "No companies registered yet"
            : `${meta.total} compan${meta.total === 1 ? "y" : "ies"} across all tenants`}
        </p>
      </header>

      <CompaniesToolbarClient q={q} />

      {rows.length === 0 ? (
        filtersActive ? (
          <EmptyFiltered />
        ) : (
          <EmptyCompanies />
        )
      ) : (
        <>
          <CompaniesTableClient rows={rows} />
          <CompaniesPagination
            meta={{
              page: meta.page,
              limit: meta.limit,
              total: meta.total,
              totalPages:
                meta.totalPages ??
                Math.max(1, Math.ceil(meta.total / meta.limit)),
            }}
            searchParams={{ q: q || undefined }}
          />
        </>
      )}
    </div>
  );
}

function EmptyCompanies() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No companies yet
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        When recruiters create companies via the onboarding flow, they show up
        here.
      </div>
    </div>
  );
}

function EmptyFiltered() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No companies match your search
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        Try a different name or clear the filters.
      </div>
      <Link
        href="/admin/companies"
        className="mt-4 inline-flex h-9 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
      >
        Clear filters
      </Link>
    </div>
  );
}
