"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { useActiveCompany } from "@/contexts/active-company-context";
import { setActiveCompanyId } from "@/lib/active-company";
import { toastApiError, toastSuccess } from "@/lib/toast";
import {
  useDeleteCompanyMutation,
  useLeaveCompanyMutation,
} from "@/hooks/use-company";
import {
  useMembersQuery,
  useTransferOwnershipMutation,
} from "@/hooks/use-members";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Danger-zone subsections. The page composes these conditionally based
 * on the caller's role so we never display an action they can't take.
 *
 * Backend rules we mirror in UI:
 *   - Leave is allowed for any active member, but the server rejects the
 *     request when the caller is the last owner (transfer first). We
 *     pre-disable the button in that case so the toast isn't the first
 *     signal the user gets.
 *   - Transfer is owner-only, requires a target member, requires typing
 *     the target's email exactly.
 *   - Delete is owner-only and requires typing the company name exactly.
 */

export function LeaveCompanyCard() {
  const ctx = useActiveCompany();
  const router = useRouter();
  const queryClient = useQueryClient();
  const leave = useLeaveCompanyMutation();
  const [open, setOpen] = useState(false);

  const role = ctx?.activeMembership?.role ?? null;
  const companyName = ctx?.activeMembership?.companyName ?? "this company";

  // Owners must transfer first if they're the last owner. We don't have
  // direct visibility into "are you the last owner?" without the members
  // query — but the backend will tell us with a 4xx, and we surface that.
  const blockReason =
    role === "owner"
      ? "Owners must transfer ownership before leaving. Use the section below."
      : null;

  async function handleConfirm() {
    try {
      const res = await leave.mutateAsync();
      // The backend returns the next active membership (or null).
      if (res.data.nextActiveCompanyId) {
        setActiveCompanyId(res.data.nextActiveCompanyId);
        queryClient.clear();
        toastSuccess(`You left ${companyName}`);
        router.push("/recruiter");
        router.refresh();
      } else {
        // No remaining memberships — user lands back at onboarding.
        setActiveCompanyId(null);
        queryClient.clear();
        toastSuccess(`You left ${companyName}`);
        router.push("/onboarding/start");
        router.refresh();
      }
      setOpen(false);
    } catch (err) {
      toastApiError(err, "Couldn't leave company");
    }
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-status-danger)] bg-[var(--color-canvas)] p-6">
      <h3 className="text-base font-semibold text-[var(--color-ink)]">
        Leave this company
      </h3>
      <p className="mt-1 text-sm text-[var(--color-body)]">
        Your access to {companyName}'s jobs, applications, and pipeline will
        be revoked immediately. Anything you created stays in the workspace.
      </p>
      {blockReason ? (
        <p className="mt-2 text-sm text-[var(--color-status-warning)]">
          {blockReason}
        </p>
      ) : null}
      <div className="mt-4">
        <Button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!!blockReason}
          className="rounded-[var(--radius-pill)] bg-[var(--color-status-danger)] px-6 text-[var(--color-on-primary)] hover:opacity-90 disabled:opacity-40"
        >
          Leave {companyName}…
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave {companyName}?</DialogTitle>
            <DialogDescription>
              You'll lose access to this workspace immediately. You can be
              re-invited later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={leave.isPending}
              className="rounded-[var(--radius-pill)] px-6"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={leave.isPending}
              className="rounded-[var(--radius-pill)] bg-[var(--color-status-danger)] px-6 text-[var(--color-on-primary)] hover:opacity-90"
            >
              {leave.isPending && <ButtonSpinner />}
              {leave.isPending ? "Leaving..." : "Leave company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function TransferOwnershipCard() {
  const ctx = useActiveCompany();
  const companyName = ctx?.activeMembership?.companyName ?? "this company";
  const transfer = useTransferOwnershipMutation();

  const { data } = useMembersQuery();
  const candidates = useMemo(
    () =>
      (data?.data ?? []).filter(
        (m) =>
          m.status === "active" &&
          m.role !== "owner" &&
          (m.role === "admin" || m.role === "recruiter") &&
          !!m.userId,
      ),
    [data?.data],
  );

  const [targetId, setTargetId] = useState<string>("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [open, setOpen] = useState(false);

  const target = candidates.find((c) => c.id === targetId) ?? null;

  async function handleConfirm() {
    if (!target) return;
    if (
      confirmEmail.trim().toLowerCase() !== target.email.trim().toLowerCase()
    ) {
      toastApiError(
        null,
        "Email doesn't match",
        "Type the member's email exactly to confirm.",
      );
      return;
    }
    try {
      await transfer.mutateAsync({
        memberId: target.id,
        values: { confirmEmail: target.email },
      });
      toastSuccess("Ownership transferred");
      setOpen(false);
      setTargetId("");
      setConfirmEmail("");
    } catch (err) {
      toastApiError(err, "Couldn't transfer ownership");
    }
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-status-danger)] bg-[var(--color-canvas)] p-6">
      <h3 className="text-base font-semibold text-[var(--color-ink)]">
        Transfer ownership
      </h3>
      <p className="mt-1 text-sm text-[var(--color-body)]">
        Promote another active member to owner. You'll be downgraded to
        admin and they'll be able to remove you.
      </p>
      {candidates.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-status-warning)]">
          You have no other active members to transfer to. Invite someone
          first.
        </p>
      ) : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <Select
          value={targetId}
          onValueChange={(v) => {
            setTargetId((v as string | null) ?? "");
            setConfirmEmail("");
          }}
          disabled={candidates.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder="Pick a member" />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {(c.user?.fullName ?? c.email) +
                  " · " +
                  c.email +
                  " · " +
                  c.role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!targetId}
          className="rounded-[var(--radius-pill)] bg-[var(--color-status-danger)] px-6 text-[var(--color-on-primary)] hover:opacity-90 disabled:opacity-40"
        >
          Transfer…
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer ownership of {companyName}?</DialogTitle>
            <DialogDescription>
              Type{" "}
              <strong>
                {target?.email ?? ""}
              </strong>{" "}
              to confirm. They'll become the owner immediately.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder={target?.email ?? ""}
            autoComplete="off"
            disabled={transfer.isPending}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={transfer.isPending}
              className="rounded-[var(--radius-pill)] px-6"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={transfer.isPending}
              className="rounded-[var(--radius-pill)] bg-[var(--color-status-danger)] px-6 text-[var(--color-on-primary)] hover:opacity-90"
            >
              {transfer.isPending && <ButtonSpinner />}
              {transfer.isPending ? "Transferring..." : "Transfer ownership"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DeleteCompanyCard() {
  const ctx = useActiveCompany();
  const router = useRouter();
  const queryClient = useQueryClient();
  const del = useDeleteCompanyMutation();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const companyName = ctx?.activeMembership?.companyName ?? "this company";
  // Recompute next active membership (any other active membership) for redirect.
  const nextActive =
    ctx?.memberships.find(
      (m) =>
        m.status === "active" && m.companyId !== ctx?.activeMembership?.companyId,
    ) ?? null;

  async function handleConfirm() {
    if (confirmName.trim().toLowerCase() !== companyName.trim().toLowerCase()) {
      toastApiError(
        null,
        "Name doesn't match",
        "Type the company name exactly to confirm.",
      );
      return;
    }
    try {
      await del.mutateAsync({ confirmName: companyName });
      toastSuccess(`${companyName} deleted`);
      if (nextActive) {
        setActiveCompanyId(nextActive.companyId);
        queryClient.clear();
        router.push("/recruiter");
        router.refresh();
      } else {
        setActiveCompanyId(null);
        queryClient.clear();
        router.push("/onboarding/start");
        router.refresh();
      }
      setOpen(false);
    } catch (err) {
      toastApiError(err, "Couldn't delete company");
    }
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-status-danger)] bg-[var(--color-canvas)] p-6">
      <h3 className="text-base font-semibold text-[var(--color-ink)]">
        Delete this company
      </h3>
      <p className="mt-1 text-sm text-[var(--color-body)]">
        Permanently delete <strong>{companyName}</strong>, including jobs,
        applications, scoring history, and team members. This cannot be
        undone.
      </p>
      <div className="mt-4">
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-[var(--radius-pill)] bg-[var(--color-status-danger)] px-6 text-[var(--color-on-primary)] hover:opacity-90"
        >
          Delete {companyName}…
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {companyName}?</DialogTitle>
            <DialogDescription>
              Type <strong>{companyName}</strong> to confirm. Everyone in
              the workspace loses access immediately.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={companyName}
            autoComplete="off"
            disabled={del.isPending}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={del.isPending}
              className="rounded-[var(--radius-pill)] px-6"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={del.isPending}
              className="rounded-[var(--radius-pill)] bg-[var(--color-status-danger)] px-6 text-[var(--color-on-primary)] hover:opacity-90"
            >
              {del.isPending && <ButtonSpinner />}
              {del.isPending ? "Deleting..." : "Delete forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
