import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { EmptyState } from "@/components/empty-state";
import { Building2 } from "lucide-react";

import { CompaniesTableClient } from "./_companies-table-client";
import { CompaniesToolbarClient } from "./_companies-toolbar-client";

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
  const hasFilters = !!q;

  // Pagination link param string (without "page")
  const filterParams = new URLSearchParams();
  if (q) filterParams.set("q", q);

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
        hasFilters ? (
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] py-16 px-6 text-center">
            <h3 className="text-lg font-semibold text-[var(--color-ink)]">
              No companies match your search
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-body)]">
              Try a different name or clear filters.
            </p>
            <div className="mt-6">
              <Link
                href="/admin/companies"
                className="inline-flex items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-6 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
              >
                Clear filters
              </Link>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            headline="No companies registered yet"
            description="When recruiters create companies via the onboarding flow, they show up here."
          />
        )
      ) : (
        <>
          <CompaniesTableClient rows={rows} />

          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
              <span>
                Page {meta.page} of {meta.totalPages} · {meta.total} total
              </span>
              <div className="flex gap-2">
                {meta.page > 1 && (
                  <Link
                    href={`?${filterParams.toString() ? `${filterParams.toString()}&` : ""}page=${meta.page - 1}`}
                    className="rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-3 py-1"
                  >
                    ← Prev
                  </Link>
                )}
                {meta.page < meta.totalPages && (
                  <Link
                    href={`?${filterParams.toString() ? `${filterParams.toString()}&` : ""}page=${meta.page + 1}`}
                    className="rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-3 py-1"
                  >
                    Next →
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
