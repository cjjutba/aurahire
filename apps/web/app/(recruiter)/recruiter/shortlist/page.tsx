import Link from "next/link";
import { redirect } from "next/navigation";
import { Star } from "lucide-react";

import { getCurrentSession } from "@/lib/auth/session";
import { EmptyState } from "@/components/empty-state";

import { ShortlistToolbarClient } from "./_shortlist-toolbar-client";
import { ShortlistPagination } from "./_shortlist-pagination";
import { ShortlistRowActionsClient } from "./_shortlist-row-actions-client";

export const metadata = { title: "Shortlist" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface MatchScore {
  overallScore: number;
  band: "strong" | "partial" | "limited";
}

interface ApplicationRow {
  id: string;
  status: string;
  appliedAt: string;
  shortlistedAt: string | null;
  matchScore: MatchScore | null;
  candidate: { id: string; fullName: string; email: string } | null;
  job: { id: string; title: string } | null;
}

interface ShortlistEnvelope {
  data: ApplicationRow[];
  meta: PaginationMeta;
}

// ---------------------------------------------------------------------------
// Status pill helpers
// ---------------------------------------------------------------------------

type AppStatusEntry = { label: string; dot: string; text: string };

const APP_STATUS: Record<string, AppStatusEntry> = {
  applied:   { label: "Applied",   dot: "bg-[var(--color-status-info)]",    text: "text-[var(--color-status-info)]" },
  screening: { label: "Screening", dot: "bg-[var(--color-status-info)]",    text: "text-[var(--color-status-info)]" },
  interview: { label: "Interview", dot: "bg-[var(--color-status-info)]",    text: "text-[var(--color-status-info)]" },
  offer:     { label: "Offer",     dot: "bg-[var(--color-status-success)]", text: "text-[var(--color-status-success)]" },
  hired:     { label: "Hired",     dot: "bg-[var(--color-status-success)]", text: "text-[var(--color-status-success)]" },
  rejected:  { label: "Rejected",  dot: "bg-[var(--color-status-danger)]",  text: "text-[var(--color-status-danger)]" },
  withdrawn: { label: "Withdrawn", dot: "bg-[var(--color-muted)]",          text: "text-[var(--color-muted)]" },
};

const DEFAULT_APP_STATUS: AppStatusEntry = {
  label: "Applied",
  dot: "bg-[var(--color-status-info)]",
  text: "text-[var(--color-status-info)]",
};

function getAppStatus(s: string): AppStatusEntry {
  return APP_STATUS[s] ?? DEFAULT_APP_STATUS;
}

// ---------------------------------------------------------------------------
// Score band color helper
// ---------------------------------------------------------------------------

function scoreBandColor(band: "strong" | "partial" | "limited"): string {
  if (band === "strong") return "text-[var(--color-score-high)]";
  if (band === "partial") return "text-[var(--color-score-mid)]";
  return "text-[var(--color-score-low)]";
}

// ---------------------------------------------------------------------------
// Avatar initials helper
// ---------------------------------------------------------------------------

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    band?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function RecruiterShortlistPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status ?? "";
  const band = sp.band ?? "";
  const sort = sp.sort ?? "recently-shortlisted";
  const page = sp.page ? Math.max(1, Number(sp.page)) : 1;
  const limit = 25;

  // Build query string for API call
  const apiParams = new URLSearchParams();
  if (q) apiParams.set("q", q);
  if (status) apiParams.set("status", status);
  if (band) apiParams.set("band", band);
  if (sort) apiParams.set("sort", sort);
  apiParams.set("page", String(page));
  apiParams.set("limit", String(limit));

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(
    `${apiUrl}/api/v1/applications/shortlist?${apiParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    },
  );

  // Graceful error
  if (!res.ok) {
    return (
      <div className="mx-auto max-w-[1280px] space-y-6">
        <header>
          <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
            Shortlist
          </h1>
        </header>
        <p className="text-sm text-[var(--color-status-danger)]">
          Failed to load shortlist. Please refresh the page.
        </p>
      </div>
    );
  }

  const body = (await res.json()) as ShortlistEnvelope;
  const rows = body.data;
  const meta = body.meta;

  // Build query string for pagination links (without "page")
  const filterParams = new URLSearchParams();
  if (q) filterParams.set("q", q);
  if (status) filterParams.set("status", status);
  if (band) filterParams.set("band", band);
  if (sort && sort !== "recently-shortlisted") filterParams.set("sort", sort);

  const hasFilters = !!(q || status || band);

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          Shortlist
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          {meta.total === 0
            ? "No candidates shortlisted yet"
            : `${meta.total} candidate${meta.total === 1 ? "" : "s"} shortlisted`}
        </p>
      </header>

      {/* Toolbar */}
      <ShortlistToolbarClient q={q} status={status} band={band} sort={sort} />

      {/* Table or empty state */}
      {rows.length === 0 ? (
        hasFilters ? (
          /* Filtered empty */
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] py-16 px-6 text-center">
            <h3 className="text-lg font-semibold text-[var(--color-ink)]">
              No shortlisted candidates match your filters
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-body)]">
              Try different search terms or filters.
            </p>
            <div className="mt-6">
              <Link
                href="/recruiter/shortlist"
                className="inline-flex items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-6 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
              >
                Clear filters
              </Link>
            </div>
          </div>
        ) : (
          /* Truly empty */
          <EmptyState
            icon={<Star className="h-6 w-6" />}
            headline="No candidates shortlisted yet"
            description="Open a candidate's application detail and click 'Shortlist' to add them here."
            cta={{ href: "/recruiter/jobs", label: "View jobs →" }}
          />
        )
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Candidate
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Job
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Score
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Shortlisted On
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Applied
                </th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const statusStyle = getAppStatus(row.status);
                const candidateName = row.candidate?.fullName ?? "Unknown";
                const candidateInitials = initials(candidateName);
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-[var(--color-hairline-soft)] hover:bg-[var(--color-surface-soft)] ${
                      idx === rows.length - 1 ? "border-b-0" : ""
                    }`}
                  >
                    {/* Candidate */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          aria-hidden
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-xs font-semibold text-[var(--color-ink)]"
                        >
                          {candidateInitials}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/recruiter/applications/${row.id}`}
                            className="block truncate font-medium text-[var(--color-ink)] hover:text-[var(--color-primary)]"
                          >
                            {candidateName}
                          </Link>
                          {row.candidate?.email && (
                            <p className="truncate text-xs text-[var(--color-muted)]">
                              {row.candidate.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Job */}
                    <td className="px-4 py-3 text-[var(--color-body)]">
                      {row.job?.title ?? "—"}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-hairline-soft)] bg-[var(--color-surface-soft)] px-2.5 py-1 text-xs font-medium ${statusStyle.text}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`}
                        />
                        {statusStyle.label}
                      </span>
                    </td>

                    {/* Score */}
                    <td className="px-4 py-3 text-right">
                      {row.matchScore ? (
                        <Link
                          href={`/recruiter/applications/${row.id}`}
                          className={`font-mono text-sm font-medium hover:underline ${scoreBandColor(row.matchScore.band)}`}
                        >
                          {row.matchScore.overallScore}/100
                        </Link>
                      ) : (
                        <span className="text-[var(--color-muted-soft)]">—</span>
                      )}
                    </td>

                    {/* Shortlisted On */}
                    <td className="px-4 py-3 text-[var(--color-body)]">
                      {row.shortlistedAt
                        ? new Date(row.shortlistedAt).toLocaleDateString()
                        : "—"}
                    </td>

                    {/* Applied */}
                    <td className="px-4 py-3 text-[var(--color-body)]">
                      {new Date(row.appliedAt).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-3 text-right">
                      <ShortlistRowActionsClient
                        applicationId={row.id}
                        status={row.status}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <ShortlistPagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={meta.limit}
          queryString={filterParams.toString()}
        />
      )}
    </div>
  );
}
