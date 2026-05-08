"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { toastSuccess, toastApiError } from "@/lib/toast";

interface WithdrawApplicationModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  applicationId: string;
  onSuccess?: () => void;
}

export function WithdrawApplicationModal({
  open,
  onOpenChange,
  applicationId,
  onSuccess,
}: WithdrawApplicationModalProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toastApiError(null, "Sign-in required");
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const res = await fetch(
        `${apiUrl}/api/v1/applications/${applicationId}/withdraw`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: reason.trim() || null }),
        },
      );
      if (!res.ok) {
        toastApiError(null, "Couldn't withdraw application");
        return;
      }
      toastSuccess("Application withdrawn");
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw application?</DialogTitle>
          <DialogDescription>
            This cannot be undone. The recruiter will be notified.
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional reason (private to you)"
          rows={4}
          maxLength={500}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)] focus:outline-none"
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-[var(--radius-pill)]"
          >
            Keep my application
          </Button>
          <Button
            onClick={submit}
            disabled={submitting}
            className="rounded-[var(--radius-pill)] border border-[var(--color-status-danger)] bg-[var(--color-canvas)] text-[var(--color-status-danger)] shadow-none hover:bg-[var(--color-status-danger)] hover:text-white"
          >
            {submitting && <ButtonSpinner />}
            Yes, withdraw
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
