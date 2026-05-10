import { redirect } from "next/navigation";
import {
  FEEDBACK_STATUS,
  FEEDBACK_TYPE,
  FEEDBACK_SEVERITY,
  type FeedbackSeverity,
  type FeedbackStatus,
  type FeedbackType,
  type UserRole,
} from "@aurahire/shared";

import { getCurrentSession } from "@/lib/auth/session";
import { FeedbackToolbarClient } from "./_feedback-toolbar-client";
import { FeedbackTableClient } from "./_feedback-table-client";

export const metadata = { title: "Feedback" };

interface PageProps {
  searchParams: Promise<{
    status?: string;
    type?: string;
    severity?: string;
    q?: string;
    page?: string;
  }>;
}

export interface FeedbackRow {
  id: string;
  submitter: {
    id: string | null;
    fullName: string;
    email: string;
    role: UserRole;
  };
  company: { id: string; name: string; logoUrl: string | null } | null;
  type: FeedbackType;
  severity: FeedbackSeverity | null;
  subject: string;
  message: string;
  pageUrl: string | null;
  userAgent: string | null;
  appVersion: string | null;
  status: FeedbackStatus;
  adminNote: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ListBody {
  data: FeedbackRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface StatusCountsBody {
  data: Record<FeedbackStatus, number>;
}

function isStatus(v: string | undefined): v is FeedbackStatus {
  return v !== undefined && (FEEDBACK_STATUS as readonly string[]).includes(v);
}
function isType(v: string | undefined): v is FeedbackType {
  return v !== undefined && (FEEDBACK_TYPE as readonly string[]).includes(v);
}
function isSeverity(v: string | undefined): v is FeedbackSeverity {
  return (
    v !== undefined && (FEEDBACK_SEVERITY as readonly string[]).includes(v)
  );
}

export default async function AdminFeedbackPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const params = new URLSearchParams();
  if (isStatus(sp.status)) params.set("status", sp.status);
  if (isType(sp.type)) params.set("type", sp.type);
  if (isSeverity(sp.severity)) params.set("severity", sp.severity);
  if (sp.q) params.set("q", sp.q);
  if (sp.page) params.set("page", sp.page);
  params.set("limit", "25");

  const [listRes, countsRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/admin/feedback?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    }),
    fetch(`${apiUrl}/api/v1/admin/feedback/status-counts`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    }),
  ]);

  if (!listRes.ok) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <p className="text-sm text-[var(--color-status-danger)]">
          Failed to load feedback. Please refresh the page.
        </p>
      </div>
    );
  }

  const body = (await listRes.json()) as ListBody;
  const counts = countsRes.ok
    ? ((await countsRes.json()) as StatusCountsBody).data
    : { new: 0, reviewing: 0, resolved: 0, dismissed: 0 };

  const filtersActive = !!(
    sp.status ||
    sp.type ||
    sp.severity ||
    (sp.q && sp.q.trim())
  );

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
            Feedback
          </h1>
          <p className="mt-1 text-sm text-[var(--color-body)]">
            {body.meta.total === 0
              ? "No feedback yet"
              : `${body.meta.total} entr${body.meta.total === 1 ? "y" : "ies"} matching filters`}
            {" · "}
            <span className="font-mono text-[var(--color-muted)]">
              {counts.new} new · {counts.reviewing} reviewing ·{" "}
              {counts.resolved} resolved · {counts.dismissed} dismissed
            </span>
          </p>
        </div>
      </header>

      <FeedbackToolbarClient
        initialQuery={sp.q ?? ""}
        status={sp.status ?? "all"}
        type={sp.type ?? "all"}
        severity={sp.severity ?? "all"}
      />

      {body.data.length === 0 ? (
        filtersActive ? (
          <EmptyFiltered />
        ) : (
          <EmptyFeedback />
        )
      ) : (
        <FeedbackTableClient
          rows={body.data}
          meta={body.meta}
          searchParams={{
            status: sp.status,
            type: sp.type,
            severity: sp.severity,
            q: sp.q,
          }}
        />
      )}
    </div>
  );
}

function EmptyFeedback() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No feedback yet
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        When users submit feedback from the sidebar popover, it will appear
        here.
      </div>
    </div>
  );
}

function EmptyFiltered() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No feedback matches your filters
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        Try different search terms or clear the filters.
      </div>
      <a
        href="/admin/feedback"
        className="mt-4 inline-flex h-9 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
      >
        Clear filters
      </a>
    </div>
  );
}
