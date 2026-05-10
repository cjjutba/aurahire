"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ActionModalsClient,
  type PendingAction,
} from "./_action-modals-client";
import { UsersPagination } from "./_users-pagination";

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
  searchParams: { role?: string; status?: string; q?: string };
}

const ROLE_BADGE: Record<string, string> = {
  candidate: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
  recruiter: "bg-[var(--color-score-high-soft)] text-[var(--color-score-high)]",
  admin: "bg-[var(--color-score-mid-soft)] text-[var(--color-score-mid)]",
};

const USER_STATUS: Record<
  string,
  { label: string; dot: string; text: string }
> = {
  active: {
    label: "Active",
    dot: "bg-[var(--color-status-success)]",
    text: "text-[var(--color-status-success)]",
  },
  suspended: {
    label: "Suspended",
    dot: "bg-[var(--color-status-warning)]",
    text: "text-[var(--color-status-warning)]",
  },
  deleted: {
    label: "Deleted",
    dot: "bg-[var(--color-muted)]",
    text: "text-[var(--color-muted)]",
  },
};

const DEFAULT_USER_STATUS = USER_STATUS["active"]!;

function getUserStatus(s: string) {
  return USER_STATUS[s] ?? DEFAULT_USER_STATUS;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function UsersTableClient({
  rows,
  currentUserId,
  meta,
  searchParams,
}: Props) {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  return (
    <>
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)]">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Name
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Email
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Role
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Status
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Created
              </th>
              <th className="w-10 px-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-hairline-soft)]">
            {rows.map((u) => {
              const isSelf = u.id === currentUserId;
              const status = getUserStatus(u.status);
              const roleClass = ROLE_BADGE[u.role] ?? "";
              return (
                <tr
                  key={u.id}
                  className="transition hover:bg-[var(--color-surface-soft)]"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-[var(--color-ink)]">
                      {u.fullName}
                    </span>
                    {isSelf && (
                      <span className="ml-1.5 text-xs text-[var(--color-muted)]">
                        (you)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-body)]">
                    {u.email}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${roleClass}`}
                    >
                      {u.role}
                    </span>
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
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-2 py-3 text-right">
                    {!isSelf && u.status !== "deleted" ? (
                      <UserRowActions user={u} onAction={setPendingAction} />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <UsersPagination meta={meta} searchParams={searchParams} />

      <ActionModalsClient
        action={pendingAction}
        onClose={() => setPendingAction(null)}
      />
    </>
  );
}

function UserRowActions({
  user,
  onAction,
}: {
  user: UserRow;
  onAction: (action: PendingAction) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="User actions"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-muted)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </button>
        }
      />
      <DropdownMenuContent align="end" side="bottom">
        {user.status === "active" && (
          <DropdownMenuItem onClick={() => onAction({ kind: "suspend", user })}>
            Suspend
          </DropdownMenuItem>
        )}
        {user.status === "suspended" && (
          <DropdownMenuItem
            onClick={() => onAction({ kind: "reactivate", user })}
          >
            Reactivate
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => onAction({ kind: "changeRole", user })}
        >
          Change Role
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAction({ kind: "forcePasswordReset", user })}
        >
          Force Password Reset
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onAction({ kind: "delete", user })}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
