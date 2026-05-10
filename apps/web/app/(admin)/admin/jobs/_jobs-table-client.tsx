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
import { JobDetailSheetClient } from "./_job-detail-sheet-client";

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

interface Props {
  rows: JobRow[];
}

const JOB_STATUS: Record<string, { label: string; dot: string; text: string }> =
  {
    draft: {
      label: "Draft",
      dot: "bg-[var(--color-muted)]",
      text: "text-[var(--color-muted)]",
    },
    published: {
      label: "Published",
      dot: "bg-[var(--color-status-success)]",
      text: "text-[var(--color-status-success)]",
    },
    closed: {
      label: "Closed",
      dot: "bg-[var(--color-status-danger)]",
      text: "text-[var(--color-status-danger)]",
    },
    archived: {
      label: "Archived",
      dot: "bg-[var(--color-muted)]",
      text: "text-[var(--color-muted)]",
    },
  };

const DEFAULT_STATUS = JOB_STATUS["draft"]!;

const INTERACTIVE_SELECTOR =
  'a, button, [role="menuitem"], [role="menu"], [role="dialog"], [data-stop-row-click], input, select, textarea, label';

function formatPosted(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function JobsTableClient({ rows }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  function handleRowClick(jobId: string) {
    return (e: MouseEvent<HTMLTableRowElement>) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
        return;
      const target = e.target as HTMLElement;
      if (target.closest(INTERACTIVE_SELECTOR)) return;
      setOpenId(jobId);
    };
  }

  function handleRowKeyDown(jobId: string) {
    return (e: KeyboardEvent<HTMLTableRowElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpenId(jobId);
      }
    };
  }

  return (
    <>
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)]">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Title
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Recruiter
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Company
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Status
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Bias
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Apps
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Posted
              </th>
              <th className="w-10 px-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-hairline-soft)]">
            {rows.map((j) => {
              const status = JOB_STATUS[j.status] ?? DEFAULT_STATUS;
              return (
                <tr
                  key={j.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Open ${j.title}`}
                  onClick={handleRowClick(j.id)}
                  onKeyDown={handleRowKeyDown(j.id)}
                  className="cursor-pointer transition hover:bg-[var(--color-surface-soft)] focus:bg-[var(--color-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]"
                >
                  <td className="px-4 py-3 font-medium text-[var(--color-ink)]">
                    {j.title}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-body)]">
                    {j.recruiter.fullName}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-body)]">
                    {j.company.name}
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
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {j.biasFlagsCount > 0 ? (
                      <span className="text-[var(--color-score-mid)]">
                        {j.biasFlagsCount}
                      </span>
                    ) : (
                      <span className="text-[var(--color-muted-soft)]">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {j.applicationsCount > 0 ? (
                      <span className="text-[var(--color-ink)]">
                        {j.applicationsCount}
                      </span>
                    ) : (
                      <span className="text-[var(--color-muted-soft)]">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--color-muted)]">
                    {formatPosted(j.publishedAt)}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            aria-label="Job actions"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-muted)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          />
                        }
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="bottom">
                        <DropdownMenuItem
                          onClick={() => setOpenId(j.id)}
                          className="flex cursor-pointer items-center gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View Details
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

      {openId && (
        <JobDetailSheetClient
          jobId={openId}
          open={!!openId}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}
