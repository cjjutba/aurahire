"use client";

import { useState } from "react";

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
import { toastSuccess, toastApiError } from "@/lib/toast";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { getActiveCompanyId } from "@/lib/active-company";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitize(internal: string): string {
  return internal
    .split("\n")
    .filter((l) => !/^\s*(internal:|concern:|note to team:)/i.test(l))
    .join("\n")
    .trim()
    .slice(0, 4000);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  interviewId: string;
  /** Sanitized version of private feedback, used as default when no existing summary. */
  defaultSummary: string;
  /** Existing shared summary (if updating). */
  currentSummary?: string | null;
  onShared?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShareFeedbackModalClient({
  open,
  onOpenChange,
  interviewId,
  defaultSummary,
  currentSummary,
  onShared,
}: Props) {
  const [summary, setSummary] = useState(
    currentSummary ?? sanitize(defaultSummary),
  );
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
      const activeCompanyId = getActiveCompanyId();
      const res = await fetch(
        `${apiUrl}/api/v1/interviews/${interviewId}/share-feedback`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            ...(activeCompanyId
              ? { "X-Active-Company-Id": activeCompanyId }
              : {}),
          },
          body: JSON.stringify({ candidateSummary: summary }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toastApiError(null, "Couldn't share feedback", body.message);
        return;
      }
      toastSuccess("Feedback shared with candidate");
      onShared?.();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share feedback with candidate</DialogTitle>
          <DialogDescription>
            This text is sent directly to the candidate via email and shown in
            their portal. Keep it constructive.
          </DialogDescription>
        </DialogHeader>

        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={10}
          maxLength={4000}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)]"
        />
        <div className="text-right text-xs text-[var(--color-muted)]">
          {summary.length} / 4000
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-[var(--radius-pill)]"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || summary.trim().length === 0}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
          >
            {submitting && <ButtonSpinner />}
            {submitting ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
