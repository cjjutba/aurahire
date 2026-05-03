"use client";

import Link from "next/link";
import { useState } from "react";
import { AuditDetailSheetClient } from "./_audit-detail-sheet-client";

interface Row {
  id: string;
  action: string;
  actorType: string;
  actor: {
    id: string;
    fullName: string;
    email: string;
    role: string | null;
  } | null;
  entityType: string;
  entityId: string;
  detailsSnippet: string;
  createdAt: string;
}

interface Props {
  rows: Row[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const ACTOR_BG: Record<string, string> = {
  user: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
  ai: "bg-[var(--color-score-mid-soft)] text-[var(--color-score-mid)]",
  system: "bg-[var(--color-surface-strong)] text-[var(--color-muted)]",
};

export function AuditTableClient({ rows, meta }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-[var(--color-hairline)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              <th className="p-3">Timestamp</th>
              <th className="p-3">Actor</th>
              <th className="p-3">Action</th>
              <th className="p-3">Entity</th>
              <th className="p-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => setOpenId(r.id)}
                className="cursor-pointer border-b border-[var(--color-hairline-soft)] last:border-b-0 hover:bg-[var(--color-surface-soft)]"
              >
                <td className="whitespace-nowrap p-3 font-mono text-xs text-[var(--color-muted)]">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ACTOR_BG[r.actorType] ?? ""}`}
                    >
                      {r.actorType}
                    </span>
                    {r.actor && (
                      <span className="text-xs text-[var(--color-body)]">
                        {r.actor.fullName}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <code className="rounded-[var(--radius-xs)] bg-[var(--color-surface-soft)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-ink)]">
                    {r.action}
                  </code>
                </td>
                <td className="p-3 text-xs">
                  <span className="text-[var(--color-body)]">
                    {r.entityType}
                  </span>
                  <span className="ml-1 font-mono text-[var(--color-muted)]">
                    #{r.entityId.slice(0, 8)}
                  </span>
                </td>
                <td className="max-w-[400px] truncate p-3 font-mono text-xs text-[var(--color-muted)]">
                  {r.detailsSnippet}
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
        <AuditDetailSheetClient
          entryId={openId}
          open={!!openId}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}
