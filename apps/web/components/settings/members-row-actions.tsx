"use client";

import { useState } from "react";
import { Copy, MoreHorizontal } from "lucide-react";

import { toastApiError, toastSuccess } from "@/lib/toast";
import {
  useRemoveMemberMutation,
  useResendInvitationMutation,
  useTransferOwnershipMutation,
  useUpdateMemberMutation,
  type CompanyMember,
} from "@/hooks/use-members";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useConfirm } from "@/components/providers/confirm-provider";

type DialogMode =
  | { kind: "none" }
  | { kind: "change-role" }
  | { kind: "transfer" };

interface Props {
  member: CompanyMember;
  /**
   * Caller's effective role in the active company. Only owner sees
   * "Transfer ownership"; admins see everything else (their backend
   * checks gate the actual writes).
   */
  callerRole: "owner" | "admin";
}

export function MembersRowActions({ member, callerRole }: Props) {
  const confirm = useConfirm();
  const [dialog, setDialog] = useState<DialogMode>({ kind: "none" });

  const isPending = member.status === "invited";
  const isSelf = member.role === "owner" && callerRole === "owner";

  const update = useUpdateMemberMutation();
  const remove = useRemoveMemberMutation();
  const resend = useResendInvitationMutation();
  const transfer = useTransferOwnershipMutation();

  // Form state for nested dialogs.
  const [newRole, setNewRole] = useState<"admin" | "recruiter">(
    member.role === "owner" ? "admin" : (member.role as "admin" | "recruiter"),
  );
  const [transferEmail, setTransferEmail] = useState("");

  async function handleResend() {
    try {
      await resend.mutateAsync(member.id);
      toastSuccess("Invitation resent", `New email sent to ${member.email}.`);
    } catch (err) {
      toastApiError(err, "Couldn't resend");
    }
  }

  async function handleCopyLink() {
    if (!member.invitationToken) {
      toastApiError(
        null,
        "No invitation token",
        "Resend the invitation first.",
      );
      return;
    }
    const url = `${window.location.origin}/invite/${member.invitationToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toastSuccess("Invite link copied to clipboard");
    } catch {
      toastApiError(null, "Couldn't copy link", "Copy it manually: " + url);
    }
  }

  async function handleSubmitChangeRole() {
    try {
      await update.mutateAsync({
        memberId: member.id,
        values: { role: newRole },
      });
      toastSuccess("Role updated");
      setDialog({ kind: "none" });
    } catch (err) {
      toastApiError(err, "Couldn't change role");
    }
  }

  async function requestRemove() {
    const ok = await confirm({
      title: isPending ? "Revoke invitation?" : "Remove team member?",
      description: isPending
        ? `${member.email} will no longer be able to accept the invite.`
        : `${member.user?.fullName ?? member.email} will lose access immediately. They keep any data already created in this workspace.`,
      confirmLabel: isPending ? "Revoke invitation" : "Remove member",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(member.id);
      toastSuccess(isPending ? "Invitation revoked" : "Member removed");
    } catch (err) {
      toastApiError(err, isPending ? "Couldn't revoke" : "Couldn't remove");
    }
  }

  async function handleSubmitTransfer() {
    if (
      transferEmail.trim().toLowerCase() !== member.email.trim().toLowerCase()
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
        memberId: member.id,
        values: { confirmEmail: member.email },
      });
      toastSuccess(
        "Ownership transferred",
        `${member.email} is now the owner.`,
      );
      setDialog({ kind: "none" });
    } catch (err) {
      toastApiError(err, "Couldn't transfer ownership");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Member actions"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-muted)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:pointer-events-none disabled:opacity-50"
            />
          }
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {isPending ? (
            <>
              <DropdownMenuItem onClick={handleResend}>
                Resend invitation
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink}>
                <Copy className="mr-2 h-4 w-4" />
                Copy invite link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => void requestRemove()}
              >
                Revoke invitation
              </DropdownMenuItem>
            </>
          ) : (
            <>
              {/* Owners can't change their own role; admins can't change anyone's role at all (server-enforced) */}
              {!isSelf && member.role !== "owner" && callerRole === "owner" ? (
                <DropdownMenuItem
                  onClick={() => {
                    setNewRole(
                      member.role === "owner"
                        ? "admin"
                        : (member.role as "admin" | "recruiter"),
                    );
                    setDialog({ kind: "change-role" });
                  }}
                >
                  Change role
                </DropdownMenuItem>
              ) : null}
              {callerRole === "owner" &&
              member.role !== "owner" &&
              member.userId ? (
                <DropdownMenuItem
                  onClick={() => {
                    setTransferEmail("");
                    setDialog({ kind: "transfer" });
                  }}
                >
                  Transfer ownership
                </DropdownMenuItem>
              ) : null}
              {!isSelf && member.role !== "owner" ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => void requestRemove()}
                  >
                    Remove from team
                  </DropdownMenuItem>
                </>
              ) : null}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Change role dialog */}
      <Dialog
        open={dialog.kind === "change-role"}
        onOpenChange={(o) => !o && setDialog({ kind: "none" })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>
              {member.user?.fullName ?? member.email} is currently{" "}
              <strong className="capitalize">{member.role}</strong>.
            </DialogDescription>
          </DialogHeader>
          <Select
            value={newRole}
            onValueChange={(v) => {
              if (v === "admin" || v === "recruiter") setNewRole(v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick a role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="recruiter">Recruiter</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog({ kind: "none" })}
              disabled={update.isPending}
              className="rounded-[var(--radius-pill)] px-6"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmitChangeRole}
              disabled={update.isPending}
              className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 hover:bg-[var(--color-primary-active)]"
            >
              {update.isPending && <ButtonSpinner />}
              {update.isPending ? "Saving..." : "Save role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer ownership dialog */}
      <Dialog
        open={dialog.kind === "transfer"}
        onOpenChange={(o) => !o && setDialog({ kind: "none" })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer ownership?</DialogTitle>
            <DialogDescription>
              <strong>{member.user?.fullName ?? member.email}</strong> will
              become the owner. You'll be downgraded to admin and can be removed
              by them. To confirm, type their email exactly:{" "}
              <strong>{member.email}</strong>.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={transferEmail}
            onChange={(e) => setTransferEmail(e.target.value)}
            placeholder={member.email}
            autoComplete="off"
            disabled={transfer.isPending}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog({ kind: "none" })}
              disabled={transfer.isPending}
              className="rounded-[var(--radius-pill)] px-6"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmitTransfer}
              disabled={transfer.isPending}
              className="rounded-[var(--radius-pill)] bg-[var(--color-status-danger)] px-6 text-[var(--color-on-primary)] hover:opacity-90"
            >
              {transfer.isPending && <ButtonSpinner />}
              {transfer.isPending ? "Transferring..." : "Transfer ownership"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
