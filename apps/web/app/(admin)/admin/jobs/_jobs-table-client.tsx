"use client";

import { useState } from "react";
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
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const STATUS_BG: Record<string, string> = {
  draft: "bg-[var(--color-surface-strong)] text-[var(--color-muted)]",
  published: "bg-[var(--color-score-high-soft)] text-[var(--color-score-high)]",
  archived: "bg-[var(--color-surface-strong)] text-[var(--color-muted)]",
  closed: "bg-[var(--color-surface-strong)] text-[var(--color-muted)]",
};

export function JobsTableClient({ rows, meta }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-[var(--color-hairline)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              <th className="p-4">Title</th>
              <th className="p-4">Recruiter</th>
              <th className="p-4">Company</th>
              <th className="p-4">Status</th>
              <th className="p-4">Bias</th>
              <th className="p-4">Apps</th>
              <th className="p-4">Posted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((j) => (
              <tr
                key={j.id}
                onClick={() => setOpenId(j.id)}
                className="cursor-pointer border-b border-[var(--color-hairline-soft)] hover:bg-[var(--color-surface-soft)] last:border-b-0"
              >
                <td className="p-4 font-medium text-[var(--color-ink)]">
                  {j.title}
                </td>
                <td className="p-4 text-sm text-[var(--color-body)]">
                  {j.recruiter.fullName}
                </td>
                <td className="p-4 text-sm text-[var(--color-body)]">
                  {j.company.name}
                </td>
                <td className="p-4">
                  <span
                    className={`inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                      STATUS_BG[j.status] ?? ""
                    }`}
                  >
                    {j.status}
                  </span>
                </td>
                <td className="p-4 text-center font-mono text-sm">
                  {j.biasFlagsCount > 0 ? (
                    <span className="text-[var(--color-score-mid)]">
                      {j.biasFlagsCount}
                    </span>
                  ) : (
                    <span className="text-[var(--color-muted)]">0</span>
                  )}
                </td>
                <td className="p-4 text-center font-mono text-sm">
                  {j.applicationsCount}
                </td>
                <td className="p-4 text-xs text-[var(--color-muted)]">
                  {j.publishedAt
                    ? new Date(j.publishedAt).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
        <span>
          Page {meta.page} of {meta.totalPages}
        </span>
        <div className="flex gap-2">
          {meta.page > 1 && (
            <a
              href={`?page=${meta.page - 1}`}
              className="rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-3 py-1"
            >
              ← Prev
            </a>
          )}
          {meta.page < meta.totalPages && (
            <a
              href={`?page=${meta.page + 1}`}
              className="rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-3 py-1"
            >
              Next →
            </a>
          )}
        </div>
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
