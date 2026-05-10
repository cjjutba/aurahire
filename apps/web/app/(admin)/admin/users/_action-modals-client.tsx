"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { USER_ROLE_DISPLAY } from "@/lib/labels";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

interface UserRef {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
}

export type PendingAction =
  | { kind: "suspend"; user: UserRef }
  | { kind: "reactivate"; user: UserRef }
  | { kind: "changeRole"; user: UserRef }
  | { kind: "delete"; user: UserRef }
  | { kind: "forcePasswordReset"; user: UserRef };

interface Props {
  action: PendingAction | null;
  onClose: () => void;
}

type RoleValue = "candidate" | "recruiter" | "admin";

async function authedFetch(path: string, init?: RequestInit) {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${session.access_token}`,
    },
  });
}

export function ActionModalsClient({ action, onClose }: Props) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [reason, setReason] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [newRole, setNewRole] = useState<RoleValue>("candidate");
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when action target changes
    setReason("");
    setEmailConfirm("");
    setResetUrl(null);
    if (action?.kind === "changeRole") {
      setNewRole(action.user.role as RoleValue);
    }
  }, [action]);

  if (!action) return null;
  const { user } = action;

  async function suspend() {
    if (reason.trim().length < 10) {
      toastApiError(
        null,
        "Check your input",
        "Reason must be at least 10 characters.",
      );
      return;
    }
    setWorking(true);
    try {
      const res = await authedFetch(`/api/v1/admin/users/${user.id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toastApiError(null, "Couldn't suspend user", body.message);
        return;
      }
      toastSuccess("User suspended");
      router.refresh();
      onClose();
    } finally {
      setWorking(false);
    }
  }

  async function reactivate() {
    setWorking(true);
    try {
      const res = await authedFetch(
        `/api/v1/admin/users/${user.id}/reactivate`,
        { method: "POST" },
      );
      if (!res.ok) {
        toastApiError(null, "Couldn't reactivate user");
        return;
      }
      toastSuccess("User reactivated");
      router.refresh();
      onClose();
    } finally {
      setWorking(false);
    }
  }

  async function changeRole() {
    if (newRole === user.role) {
      toastApiError(null, "Check your input", "Pick a different role.");
      return;
    }
    setWorking(true);
    try {
      const res = await authedFetch(`/api/v1/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newRole }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toastApiError(null, "Couldn't change role", body.message);
        return;
      }
      toastSuccess("User role changed", `Now ${USER_ROLE_DISPLAY[newRole]}.`);
      router.refresh();
      onClose();
    } finally {
      setWorking(false);
    }
  }

  async function deleteUser() {
    if (emailConfirm !== user.email) {
      toastApiError(
        null,
        "Check your input",
        "Email confirmation does not match.",
      );
      return;
    }
    setWorking(true);
    try {
      const res = await authedFetch(`/api/v1/admin/users/${user.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toastApiError(null, "Couldn't delete user", body.message);
        return;
      }
      toastSuccess("User deleted");
      router.refresh();
      onClose();
    } finally {
      setWorking(false);
    }
  }

  async function forcePasswordReset() {
    setWorking(true);
    try {
      const res = await authedFetch(
        `/api/v1/admin/users/${user.id}/force-password-reset`,
        { method: "POST" },
      );
      if (!res.ok) {
        toastApiError(null, "Couldn't send reset link");
        return;
      }
      const body = (await res.json()) as {
        data: { resetUrl: string; emailSent: boolean };
      };
      setResetUrl(body.data.resetUrl);
      if (body.data.emailSent) {
        toastSuccess("Reset link sent");
      } else {
        toastSuccess(
          "Reset link ready",
          "Email delivery failed. Copy the URL below to deliver manually.",
        );
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog
      open={!!action}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        {action.kind === "suspend" && (
          <>
            <DialogHeader>
              <DialogTitle>Suspend {user.fullName}</DialogTitle>
              <DialogDescription>
                The user will lose access immediately. Reason is captured in the
                audit log.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (≥10 characters)"
              rows={3}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={onClose}
                className="rounded-[var(--radius-pill)]"
              >
                Cancel
              </Button>
              <Button
                onClick={suspend}
                disabled={working || reason.trim().length < 10}
                className="rounded-[var(--radius-pill)] bg-[var(--color-status-danger)] hover:bg-[var(--color-status-danger)]"
              >
                {working && <ButtonSpinner />}
                {working ? "Suspending..." : "Confirm suspend"}
              </Button>
            </DialogFooter>
          </>
        )}

        {action.kind === "reactivate" && (
          <>
            <DialogHeader>
              <DialogTitle>Reactivate {user.fullName}?</DialogTitle>
              <DialogDescription>
                The user will regain access.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={onClose}
                className="rounded-[var(--radius-pill)]"
              >
                Cancel
              </Button>
              <Button
                onClick={reactivate}
                disabled={working}
                className="rounded-[var(--radius-pill)] bg-[var(--color-primary)]"
              >
                {working && <ButtonSpinner />}
                {working ? "Reactivating..." : "Reactivate"}
              </Button>
            </DialogFooter>
          </>
        )}

        {action.kind === "changeRole" && (
          <>
            <DialogHeader>
              <DialogTitle>Change role for {user.fullName}</DialogTitle>
              <DialogDescription>
                Currently: <strong>{user.role}</strong>
              </DialogDescription>
            </DialogHeader>
            <Select
              value={newRole}
              onValueChange={(v) => setNewRole((v as RoleValue) ?? "candidate")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="candidate">Candidate</SelectItem>
                <SelectItem value="recruiter">Recruiter</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={onClose}
                className="rounded-[var(--radius-pill)]"
              >
                Cancel
              </Button>
              <Button
                onClick={changeRole}
                disabled={working || newRole === user.role}
                className="rounded-[var(--radius-pill)] bg-[var(--color-primary)]"
              >
                {working && <ButtonSpinner />}
                {working ? "Changing..." : `Change to ${newRole}`}
              </Button>
            </DialogFooter>
          </>
        )}

        {action.kind === "delete" && (
          <>
            <DialogHeader>
              <DialogTitle>Delete {user.fullName}?</DialogTitle>
              <DialogDescription>
                This soft-deletes the profile (status=&apos;deleted&apos;) and
                removes the auth.users row. Their data persists for audit. Type{" "}
                <strong>{user.email}</strong> to confirm.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={emailConfirm}
              onChange={(e) => setEmailConfirm(e.target.value)}
              placeholder={user.email}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={onClose}
                className="rounded-[var(--radius-pill)]"
              >
                Cancel
              </Button>
              <Button
                onClick={deleteUser}
                disabled={working || emailConfirm !== user.email}
                className="rounded-[var(--radius-pill)] bg-[var(--color-status-danger)] hover:bg-[var(--color-status-danger)]"
              >
                {working && <ButtonSpinner />}
                {working ? "Deleting..." : "Confirm delete"}
              </Button>
            </DialogFooter>
          </>
        )}

        {action.kind === "forcePasswordReset" && (
          <>
            <DialogHeader>
              <DialogTitle>
                Force password reset for {user.fullName}?
              </DialogTitle>
              <DialogDescription>
                Generates a 1h reset token and emails the user. The reset URL
                will also be displayed here so you can deliver it manually if
                email fails.
              </DialogDescription>
            </DialogHeader>
            {!resetUrl ? (
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="rounded-[var(--radius-pill)]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={forcePasswordReset}
                  disabled={working}
                  className="rounded-[var(--radius-pill)] bg-[var(--color-primary)]"
                >
                  {working && <ButtonSpinner />}
                  {working ? "Generating..." : "Generate + email"}
                </Button>
              </DialogFooter>
            ) : (
              <>
                <div className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Reset URL
                  </p>
                  <code className="mt-2 block break-all font-mono text-xs text-[var(--color-ink)]">
                    {resetUrl}
                  </code>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      void navigator.clipboard.writeText(resetUrl);
                      toastSuccess("Copied to clipboard", "Reset URL.");
                    }}
                    className="rounded-[var(--radius-pill)] bg-[var(--color-primary)]"
                  >
                    Copy URL
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="rounded-[var(--radius-pill)]"
                  >
                    Close
                  </Button>
                </DialogFooter>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
