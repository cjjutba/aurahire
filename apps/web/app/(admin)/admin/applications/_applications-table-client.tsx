"use client";

import { useState } from "react";
import Link from "next/link";
import { ScoreRing } from "@/components/score/score-ring";
import { MatchBandChip } from "@/components/score/match-band-chip";
import { ApplicationDetailSheetClient } from "./_application-detail-sheet-client";

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

const STATUS_BG: Record<string, string> = {
  applied: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
  screening: "bg-[var(--color-score-mid-soft)] text-[var(--color-score-mid)]",
  interview: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
  offer: "bg-[var(--color-score-high-soft)] text-[var(--color-score-high)]",
  hired: "bg-[var(--color-score-high-soft)] text-[var(--color-score-high)]",
  rejected: "bg-[var(--color-score-low-soft)] text-[var(--color-score-low)]",
  withdrawn: "bg-[var(--color-surface-strong)] text-[var(--color-muted)]",
};

export function ApplicationsTableClient({ rows, meta }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-[var(--color-hairline)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              <th className="p-4">Candidate</th>
              <th className="p-4">Job</th>
              <th className="p-4">Score</th>
              <th className="p-4">Band</th>
              <th className="p-4">Status</th>
              <th className="p-4">Applied</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => setOpenId(r.id)}
                className="cursor-pointer border-b border-[var(--color-hairline-soft)] last:border-b-0 hover:bg-[var(--color-surface-soft)]"
              >
                <td className="p-4">
                  <p className="font-medium text-[var(--color-ink)]">
                    {r.candidate.fullName}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {r.candidate.email}
                  </p>
                </td>
                <td className="p-4">
                  <p className="font-medium text-[var(--color-ink)]">
                    {r.job.title}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {r.job.companyName} · {r.job.recruiterName}
                  </p>
                </td>
                <td className="p-4">
                  {r.overallScore != null && r.band ? (
                    <div className="flex items-center gap-3">
                      <ScoreRing
                        score={r.overallScore}
                        band={r.band}
                        size="sm"
                      />
                      <span className="font-mono text-sm text-[var(--color-ink)]">
                        {r.overallScore}/100
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--color-muted)]">
                      Pending
                    </span>
                  )}
                </td>
                <td className="p-4">
                  {r.band ? (
                    <MatchBandChip band={r.band} />
                  ) : (
                    <span className="text-xs text-[var(--color-muted)]">—</span>
                  )}
                </td>
                <td className="p-4">
                  <span
                    className={`inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${STATUS_BG[r.status] ?? ""}`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="p-4 text-xs text-[var(--color-muted)]">
                  {new Date(r.appliedAt).toLocaleDateString()}
                </td>
                <td className="p-4 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenId(r.id);
                    }}
                    className="rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-3 py-1 text-xs text-[var(--color-body)] hover:bg-[var(--color-surface-soft)]"
                  >
                    View full breakdown →
                  </button>
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
            <Link
              href={`?page=${meta.page - 1}`}
              className="rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-3 py-1"
            >
              ← Prev
            </Link>
          )}
          {meta.page < meta.totalPages && (
            <Link
              href={`?page=${meta.page + 1}`}
              className="rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-3 py-1"
            >
              Next →
            </Link>
          )}
        </div>
      </div>

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
