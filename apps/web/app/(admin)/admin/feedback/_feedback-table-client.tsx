"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  FeedbackSeverity,
  FeedbackStatus,
  FeedbackType,
} from "@aurahire/shared";

import { FeedbackDetailSheetClient } from "./_feedback-detail-sheet-client";
import type { FeedbackRow } from "./page";

interface Props {
  rows: FeedbackRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  searchParams: {
    status?: string;
    type?: string;
    severity?: string;
    q?: string;
  };
}

const STATUS_STYLE: Record<
  FeedbackStatus,
  { dot: string; text: string; label: string }
> = {
  new: {
    dot: "bg-[var(--color-status-info)]",
    text: "text-[var(--color-status-info)]",
    label: "New",
  },
  reviewing: {
    dot: "bg-[var(--color-status-warning)]",
    text: "text-[var(--color-status-warning)]",
    label: "Reviewing",
  },
  resolved: {
    dot: "bg-[var(--color-status-success)]",
    text: "text-[var(--color-status-success)]",
    label: "Resolved",
  },
  dismissed: {
    dot: "bg-[var(--color-muted)]",
    text: "text-[var(--color-muted)]",
    label: "Dismissed",
  },
};

const TYPE_STYLE: Record<FeedbackType, string> = {
  bug: "bg-[var(--color-score-low-soft)] text-[var(--color-score-low)]",
  suggestion: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
  praise: "bg-[var(--color-score-high-soft)] text-[var(--color-score-high)]",
  question: "bg-[var(--color-score-mid-soft)] text-[var(--color-score-mid)]",
  other: "bg-[var(--color-surface-strong)] text-[var(--color-body)]",
};

const SEVERITY_STYLE: Record<FeedbackSeverity, string> = {
  low: "text-[var(--color-muted)]",
  normal: "text-[var(--color-body)]",
  high: "text-[var(--color-status-danger)]",
};

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function FeedbackTableClient({ rows, meta, searchParams }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)]">
              <Th>Type</Th>
              <Th>Subject</Th>
              <Th>Submitter</Th>
              <Th>Status</Th>
              <Th className="text-right">When</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-hairline-soft)]">
            {rows.map((r) => {
              const status = STATUS_STYLE[r.status];
              return (
                <tr
                  key={r.id}
                  onClick={() => setActiveId(r.id)}
                  className="cursor-pointer transition hover:bg-[var(--color-surface-soft)]"
                >
                  <td className="px-4 py-3 align-top">
                    <span
                      className={`inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${TYPE_STYLE[r.type]}`}
                    >
                      {r.type}
                    </span>
                    {r.type === "bug" && r.severity ? (
                      <span
                        className={`mt-1 block text-[11px] uppercase tracking-wider ${SEVERITY_STYLE[r.severity]}`}
                      >
                        {r.severity}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="line-clamp-2 font-medium text-[var(--color-ink)]">
                      {r.subject}
                    </span>
                    <span className="mt-1 line-clamp-1 text-xs text-[var(--color-muted)]">
                      {r.message}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-[var(--color-ink)]">
                      {r.submitter.fullName}
                    </div>
                    <div className="text-xs text-[var(--color-muted)]">
                      {r.submitter.email}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                      {r.submitter.role}
                      {r.company ? ` · ${r.company.name}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${status.text}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                        aria-hidden
                      />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right align-top text-xs text-[var(--color-muted)]">
                    {formatRelative(r.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <FeedbackPagination meta={meta} searchParams={searchParams} />

      {activeId ? (
        <FeedbackDetailSheetClient
          entryId={activeId}
          open={true}
          onClose={() => setActiveId(null)}
        />
      ) : null}
    </>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={[
        "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </th>
  );
}

function FeedbackPagination({
  meta,
  searchParams,
}: {
  meta: { page: number; limit: number; total: number; totalPages: number };
  searchParams: Record<string, string | undefined>;
}) {
  if (meta.totalPages <= 1) return null;
  const start = (meta.page - 1) * meta.limit + 1;
  const end = Math.min(meta.page * meta.limit, meta.total);

  function hrefFor(page: number): string {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v != null && v !== "" && k !== "page") params.set(k, v);
    });
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/admin/feedback${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <div className="text-xs text-[var(--color-muted)]">
        Showing <span className="font-mono">{start}</span>–
        <span className="font-mono">{end}</span> of{" "}
        <span className="font-mono">{meta.total}</span>
      </div>
      <div className="flex items-center gap-1">
        <PageNav
          href={hrefFor(meta.page - 1)}
          disabled={meta.page === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </PageNav>
        <span className="px-2 text-sm text-[var(--color-body)]">
          Page <span className="font-mono">{meta.page}</span> of{" "}
          <span className="font-mono">{meta.totalPages}</span>
        </span>
        <PageNav
          href={hrefFor(meta.page + 1)}
          disabled={meta.page === meta.totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </PageNav>
      </div>
    </div>
  );
}

function PageNav({
  href,
  children,
  disabled,
  ...rest
}: {
  href: string;
  disabled?: boolean;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const className =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-[var(--radius-md)] px-2 text-sm transition text-[var(--color-body)] hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]";
  if (disabled) {
    return (
      <span className={`${className} pointer-events-none opacity-40`} {...rest}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}
