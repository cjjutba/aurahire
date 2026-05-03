"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ActionModalsClient,
  type PendingAction,
} from "./_action-modals-client";

interface UserRow {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Props {
  rows: UserRow[];
  currentUserId: string | null;
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const ROLE_BG: Record<string, string> = {
  candidate: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
  recruiter: "bg-[var(--color-score-high-soft)] text-[var(--color-score-high)]",
  admin: "bg-[var(--color-score-mid-soft)] text-[var(--color-score-mid)]",
};

const STATUS_BG: Record<string, string> = {
  active: "bg-[var(--color-score-high-soft)] text-[var(--color-score-high)]",
  suspended: "bg-[var(--color-score-mid-soft)] text-[var(--color-score-mid)]",
  deleted: "bg-[var(--color-surface-strong)] text-[var(--color-muted)]",
};

export function UsersTableClient({ rows, currentUserId, meta }: Props) {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-[var(--color-hairline)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              <th className="p-4">Name</th>
              <th className="p-4">Email</th>
              <th className="p-4">Role</th>
              <th className="p-4">Status</th>
              <th className="p-4">Created</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr
                  key={u.id}
                  className="border-b border-[var(--color-hairline-soft)] last:border-b-0"
                >
                  <td className="p-4 font-medium text-[var(--color-ink)]">
                    {u.fullName}
                    {isSelf && (
                      <span className="ml-1 text-xs text-[var(--color-muted)]">
                        (you)
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-[var(--color-body)]">
                    {u.email}
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                        ROLE_BG[u.role] ?? ""
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                        STATUS_BG[u.status] ?? ""
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-[var(--color-muted)]">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    {!isSelf && u.status !== "deleted" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button className="rounded-[var(--radius-md)] p-1 hover:bg-[var(--color-surface-soft)]">
                              <MoreHorizontal className="h-4 w-4 text-[var(--color-muted)]" />
                            </button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          {u.status === "active" && (
                            <DropdownMenuItem
                              onClick={() =>
                                setPendingAction({ kind: "suspend", user: u })
                              }
                            >
                              Suspend
                            </DropdownMenuItem>
                          )}
                          {u.status === "suspended" && (
                            <DropdownMenuItem
                              onClick={() =>
                                setPendingAction({ kind: "reactivate", user: u })
                              }
                            >
                              Reactivate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() =>
                              setPendingAction({ kind: "changeRole", user: u })
                            }
                          >
                            Change Role
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setPendingAction({
                                kind: "forcePasswordReset",
                                user: u,
                              })
                            }
                          >
                            Force Password Reset
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() =>
                              setPendingAction({ kind: "delete", user: u })
                            }
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              );
            })}
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

      <ActionModalsClient
        action={pendingAction}
        onClose={() => setPendingAction(null)}
      />
    </>
  );
}
