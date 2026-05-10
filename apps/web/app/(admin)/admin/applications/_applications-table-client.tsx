"use client";

import { useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { Eye, MoreHorizontal } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScoreRing } from "@/components/score/score-ring";
import { MatchBandChip } from "@/components/score/match-band-chip";
import { ApplicationDetailSheetClient } from "./_application-detail-sheet-client";
import { ApplicationsPagination } from "./_pagination";

const INTERACTIVE_SELECTOR =
  'a, button, [role="menuitem"], [role="menu"], [role="dialog"], [data-stop-row-click], input, select, textarea, label';

interface Row {
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
}

interface Props {
  rows: Row[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const APP_STATUS: Record<string, { label: string; dot: string; text: string }> =
  {
    applied: {
      label: "Applied",
      dot: "bg-[var(--color-status-info)]",
      text: "text-[var(--color-status-info)]",
    },
    screening: {
      label: "Screening",
      dot: "bg-[var(--color-status-warning)]",
      text: "text-[var(--color-status-warning)]",
    },
    interview: {
      label: "Interview",
      dot: "bg-[var(--color-status-info)]",
      text: "text-[var(--color-status-info)]",
    },
    offer: {
      label: "Offer",
      dot: "bg-[var(--color-status-success)]",
      text: "text-[var(--color-status-success)]",
    },
    hired: {
      label: "Hired",
      dot: "bg-[var(--color-status-success)]",
      text: "text-[var(--color-status-success)]",
    },
    rejected: {
      label: "Rejected",
      dot: "bg-[var(--color-status-danger)]",
      text: "text-[var(--color-status-danger)]",
    },
    withdrawn: {
      label: "Withdrawn",
      dot: "bg-[var(--color-muted)]",
      text: "text-[var(--color-muted)]",
    },
  };

const DEFAULT_APP_STATUS = APP_STATUS["applied"]!;

function getAppStatus(s: string) {
  return APP_STATUS[s] ?? { ...DEFAULT_APP_STATUS, label: s };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ApplicationsTableClient({ rows, meta }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  function handleRowClick(e: MouseEvent<HTMLTableRowElement>, id: string) {
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
      return;
    const target = e.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    setOpenId(id);
  }

  function handleRowKeyDown(e: KeyboardEvent<HTMLTableRowElement>, id: string) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpenId(id);
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)]">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Candidate
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Job
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Score
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Band
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Status
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Applied
              </th>
              <th className="w-10 px-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-hairline-soft)]">
            {rows.map((r) => {
              const status = getAppStatus(r.status);
              return (
                <tr
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open application from ${r.candidate.fullName}`}
                  onClick={(e) => handleRowClick(e, r.id)}
                  onKeyDown={(e) => handleRowKeyDown(e, r.id)}
                  className="cursor-pointer transition hover:bg-[var(--color-surface-soft)] focus:bg-[var(--color-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--color-ink)]">
                      {r.candidate.fullName}
                    </p>
                    <p className="truncate text-xs text-[var(--color-muted)]">
                      {r.candidate.email}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--color-ink)]">
                      {r.job.title}
                    </p>
                    <p className="truncate text-xs text-[var(--color-muted)]">
                      {r.job.companyName}
                      <span className="text-[var(--color-muted-soft)]">
                        {" "}
                        ·{" "}
                      </span>
                      {r.job.recruiterName}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {r.overallScore != null && r.band ? (
                      <div className="flex items-center gap-3">
                        <ScoreRing
                          score={r.overallScore}
                          band={r.band}
                          size="sm"
                        />
                        <span className="font-mono text-sm text-[var(--color-ink)]">
                          {r.overallScore}
                          <span className="text-[var(--color-muted)]">
                            /100
                          </span>
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--color-muted)]">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.band ? (
                      <MatchBandChip band={r.band} />
                    ) : (
                      <span className="text-xs text-[var(--color-muted)]">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3 text-[var(--color-muted)]">
                    {formatDate(r.appliedAt)}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            aria-label="Application actions"
                            data-stop-row-click
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-muted)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          />
                        }
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="bottom">
                        <DropdownMenuItem
                          onClick={() => setOpenId(r.id)}
                          className="flex cursor-pointer items-center gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View full breakdown
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ApplicationsPagination meta={meta} />

      {openId && (
        <ApplicationDetailSheetClient
          applicationId={openId}
          open={!!openId}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}
