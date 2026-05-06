"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, MoreHorizontal } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { toastSuccess, toastApiError } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { AdminCompanyRow } from "./page";

async function authedFetch(
  path: string,
  init: RequestInit,
): Promise<Response> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${session.access_token}`,
    },
  });
}

interface Props {
  rows: AdminCompanyRow[];
}

export function CompaniesTableClient({ rows }: Props) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState<AdminCompanyRow | null>(
    null,
  );
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);

  function openDelete(row: AdminCompanyRow) {
    setConfirmDelete(row);
    setConfirmName("");
  }

  function closeDelete() {
    if (busy) return;
    setConfirmDelete(null);
    setConfirmName("");
  }

  async function performDelete() {
    if (!confirmDelete) return;
    if (confirmName !== confirmDelete.name) {
      toastApiError(
        null,
        "Name does not match",
        "Type the company name exactly to confirm.",
      );
      return;
    }
    setBusy(true);
    try {
      const res = await authedFetch(
        `/api/v1/admin/companies/${confirmDelete.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toastApiError({ body }, "Delete failed");
        return;
      }
      toastSuccess(`Deleted "${confirmDelete.name}"`);
      setConfirmDelete(null);
      setConfirmName("");
      router.refresh();
    } catch (err) {
      toastApiError(err, "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  function notImplemented(action: string) {
    toastApiError(
      null,
      `${action} not yet wired`,
      "Suspension requires a follow-up schema migration. The action is stubbed for this phase.",
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)]">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Company
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Owner
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Members
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Jobs
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Created
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Status
              </th>
              <th className="w-10 px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isLast = idx === rows.length - 1;
              return (
                <tr
                  key={row.id}
                  className={`border-b border-[var(--color-hairline-soft)] hover:bg-[var(--color-surface-soft)] ${
                    isLast ? "border-b-0" : ""
                  }`}
                >
                  {/* Company */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {row.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.logoUrl}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-[var(--radius-sm)] object-cover"
                        />
                      ) : (
                        <div
                          aria-hidden
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-strong)] text-[var(--color-muted)]"
                        >
                          <Building2 className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-medium text-[var(--color-ink)]">
                          {row.name}
                        </div>
                        {row.industry && (
                          <p className="truncate text-xs text-[var(--color-muted)]">
                            {row.industry}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Owner */}
                  <td className="px-4 py-3">
                    {row.owner.name ? (
                      <div>
                        <div className="text-[var(--color-ink)]">
                          {row.owner.name}
                        </div>
                        {row.owner.email && (
                          <div className="text-xs text-[var(--color-muted)]">
                            {row.owner.email}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[var(--color-muted-soft)]">—</span>
                    )}
                  </td>

                  {/* Members */}
                  <td className="px-4 py-3 text-right font-mono text-sm text-[var(--color-body)]">
                    {row.memberCount}
                  </td>

                  {/* Jobs */}
                  <td className="px-4 py-3 text-right font-mono text-sm text-[var(--color-body)]">
                    {row.jobCount}
                  </td>

                  {/* Created */}
                  <td className="px-4 py-3 text-[var(--color-body)]">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-hairline-soft)] bg-[var(--color-surface-soft)] px-2.5 py-1 text-xs font-medium ${
                        row.status === "active"
                          ? "text-[var(--color-status-success)]"
                          : "text-[var(--color-status-warning)]"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          row.status === "active"
                            ? "bg-[var(--color-status-success)]"
                            : "bg-[var(--color-status-warning)]"
                        }`}
                      />
                      {row.status === "active" ? "Active" : "Suspended"}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-2 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-pill)] text-[var(--color-muted)] hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]"
                            aria-label={`Actions for ${row.name}`}
                          />
                        }
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {row.status === "active" ? (
                          <DropdownMenuItem
                            onSelect={() => notImplemented("Suspend")}
                          >
                            Suspend
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onSelect={() => notImplemented("Restore")}
                          >
                            Restore
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onSelect={() => notImplemented("View as")}
                        >
                          View as…
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => openDelete(row)}
                          className="text-[var(--color-status-danger)] focus:text-[var(--color-status-danger)]"
                        >
                          Delete…
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

      <Dialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && closeDelete()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete company</DialogTitle>
          </DialogHeader>
          {confirmDelete && (
            <div className="space-y-3 text-sm">
              <p className="text-[var(--color-body)]">
                You are about to permanently delete{" "}
                <strong className="text-[var(--color-ink)]">
                  {confirmDelete.name}
                </strong>
                . This cascades to its members, jobs, and applications. This
                action cannot be undone.
              </p>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Type{" "}
                  <code className="font-mono text-[var(--color-ink)]">
                    {confirmDelete.name}
                  </code>{" "}
                  to confirm
                </label>
                <Input
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  autoFocus
                  disabled={busy}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDelete} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={performDelete}
              disabled={
                busy ||
                !confirmDelete ||
                confirmName !== (confirmDelete?.name ?? "")
              }
              className="bg-[var(--color-status-danger)] text-white hover:bg-[var(--color-status-danger)]/90"
            >
              {busy ? "Deleting…" : "Delete company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
