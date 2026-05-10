import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { FiltersClient } from "./_filters-client";
import { AuditTableClient } from "./_audit-table-client";
import { ExportButtonClient } from "./_export-button-client";
import { AuditRealtimeClient } from "./_audit-realtime-client";

export const metadata = { title: "Audit Log" };

interface PageProps {
  searchParams: Promise<{
    actorId?: string;
    q?: string;
    entityType?: string;
    action?: string;
    actorType?: string;
    companyId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}

interface ListBody {
  data: Array<{
    id: string;
    action: string;
    actorType: string;
    actor: {
      id: string;
      fullName: string;
      email: string;
      role: string | null;
    } | null;
    company: { id: string; name: string; logoUrl: string | null } | null;
    entityType: string;
    entityId: string;
    detailsSnippet: string;
    createdAt: string;
  }>;
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface CompanyOption {
  id: string;
  name: string;
  logoUrl: string | null;
}

function buildParams(sp: Awaited<PageProps["searchParams"]>): URLSearchParams {
  const p = new URLSearchParams();
  if (sp.actorId) p.set("actorId", sp.actorId);
  if (sp.q) p.set("q", sp.q);
  if (sp.entityType) p.set("entityType", sp.entityType);
  if (sp.action) p.set("action", sp.action);
  if (sp.actorType) p.set("actorType", sp.actorType);
  if (sp.companyId) p.set("companyId", sp.companyId);
  if (sp.dateFrom) p.set("dateFrom", sp.dateFrom);
  if (sp.dateTo) p.set("dateTo", sp.dateTo);
  if (sp.page) p.set("page", sp.page);
  p.set("limit", "50");
  return p;
}

export default async function AuditPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const params = buildParams(sp);

  const [res, companiesRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/admin/audit?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    }),
    fetch(`${apiUrl}/api/v1/admin/companies/options`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    }),
  ]);
  if (!res.ok) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <p className="text-sm text-[var(--color-status-danger)]">
          Failed to load audit log.
        </p>
      </div>
    );
  }
  const body = (await res.json()) as ListBody;
  const companyOptions: CompanyOption[] = companiesRes.ok
    ? ((await companiesRes.json()) as { data: CompanyOption[] }).data
    : [];

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <AuditRealtimeClient />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
            Audit Log
          </h1>
          <p className="mt-1 text-sm text-[var(--color-body)]">
            {body.meta.total} entr{body.meta.total === 1 ? "y" : "ies"} matching
            filters · append-only
          </p>
        </div>
        <ExportButtonClient currentParams={params.toString()} />
      </header>

      <FiltersClient initialFilters={sp} companies={companyOptions} />

      {body.data.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] py-16 text-center">
          <h3 className="text-lg font-semibold text-[var(--color-ink)]">
            No audit entries match these filters
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-body)]">
            Widen the date range or clear the actor/entity filters.
          </p>
        </div>
      ) : (
        <AuditTableClient rows={body.data} meta={body.meta} />
      )}
    </div>
  );
}
