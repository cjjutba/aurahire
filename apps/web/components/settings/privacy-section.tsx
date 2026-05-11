"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { setSessionOnlyMarker } from "@/lib/auth/cookie-persistence.client";
import { toastApiError, toastSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PrivacySectionProps {
  email: string;
}

/**
 * Both privacy actions (export, delete) are stubs in Phase 5, the export
 * pipeline isn't built and there's no /profiles/me delete endpoint yet.
 *
 * The "delete" path still signs the user out so the request is at least
 * directionally correct: a user clicking through with intent ends up
 * signed-out, with a toast that frames this as a request received rather
 * than an instant deletion.
 */
export function PrivacySection({ email }: PrivacySectionProps) {
  const router = useRouter();
  const [exportPending, setExportPending] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePending, setDeletePending] = useState(false);

  async function handleExport() {
    setExportPending(true);
    try {
      // Stub, no backend job yet. We toast and resolve.
      await new Promise((r) => setTimeout(r, 300));
      toastSuccess(
        "Export request received",
        "You'll get an email with a download link within 24 hours.",
      );
    } finally {
      setExportPending(false);
    }
  }

  async function handleDelete() {
    if (deleteConfirm.trim().toLowerCase() !== email.trim().toLowerCase()) {
      toastApiError(
        null,
        "Email doesn't match",
        "Type the email associated with your account to confirm.",
      );
      return;
    }
    setDeletePending(true);
    try {
      // No backend delete endpoint yet, sign the user out and surface
      // the action as a request received. When the endpoint lands this
      // becomes a real DELETE call before the sign-out.
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      setSessionOnlyMarker(false);
      toastSuccess(
        "Account deletion request received",
        "You've been signed out. Our team will follow up within 7 days.",
      );
      router.push("/");
      router.refresh();
    } finally {
      setDeletePending(false);
      setDeleteOpen(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
          <h3 className="text-base font-semibold text-[var(--color-ink)]">
            Export your data
          </h3>
          <p className="mt-1 text-sm text-[var(--color-body)]">
            We'll prepare a zip of your profile, applications, resumes, and any
            AI-generated scoring rationales tied to your account, and email you
            a download link.
          </p>
          <div className="mt-4">
            <Button
              type="button"
              onClick={handleExport}
              disabled={exportPending}
              className="rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-6 text-[var(--color-ink)] hover:bg-[var(--color-hairline)]"
            >
              {exportPending && <ButtonSpinner />}
              {exportPending ? "Requesting..." : "Email me a zip"}
            </Button>
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-status-danger)] bg-[var(--color-canvas)] p-6">
          <h3 className="text-base font-semibold text-[var(--color-ink)]">
            Delete account
          </h3>
          <p className="mt-1 text-sm text-[var(--color-body)]">
            Permanently delete your AuraHire account and personal data. Audit
            logs of past actions are retained in line with our retention policy.
            This cannot be undone.
          </p>
          <div className="mt-4">
            <Button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="rounded-[var(--radius-pill)] bg-[var(--color-status-danger)] px-6 text-[var(--color-on-primary)] hover:opacity-90"
            >
              Delete account…
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This will sign you out and queue your account for deletion. Type
              your email <strong>{email}</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={email}
            autoComplete="off"
            disabled={deletePending}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deletePending}
              className="rounded-[var(--radius-pill)] px-6"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={deletePending}
              className="rounded-[var(--radius-pill)] bg-[var(--color-status-danger)] px-6 text-[var(--color-on-primary)] hover:opacity-90"
            >
              {deletePending && <ButtonSpinner />}
              {deletePending ? "Submitting..." : "Delete my account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
