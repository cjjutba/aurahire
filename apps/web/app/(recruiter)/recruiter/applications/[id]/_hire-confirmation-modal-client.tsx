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

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  candidateName: string;
  jobTitle: string;
  siblingInflightCount: number;
  /** Resolves with the recruiter's choice. Caller invokes the hire request. */
  onConfirm: (autoRejectOthers: boolean) => Promise<void>;
}

export function HireConfirmationModalClient({
  open,
  onOpenChange,
  candidateName,
  jobTitle,
  siblingInflightCount,
  onConfirm,
}: Props) {
  const [autoReject, setAutoReject] = useState<boolean>(
    siblingInflightCount > 0,
  );
  const [working, setWorking] = useState(false);

  async function handleConfirm() {
    setWorking(true);
    try {
      await onConfirm(autoReject);
      onOpenChange(false);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (working && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md gap-0 p-6">
        <DialogHeader className="gap-2">
          <DialogTitle className="text-base font-semibold">
            Hire {candidateName}?
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-[var(--color-body)]">
            This will mark {candidateName} as hired for {jobTitle}.
          </DialogDescription>
        </DialogHeader>

        {siblingInflightCount > 0 && (
          <label className="mt-4 flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-3 text-sm">
            <input
              type="checkbox"
              checked={autoReject}
              onChange={(e) => setAutoReject(e.target.checked)}
              disabled={working}
              className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
            />
            <span className="text-[var(--color-ink)]">
              Auto-reject the {siblingInflightCount} other open applicant
              {siblingInflightCount === 1 ? "" : "s"} on this job.
              <span className="mt-1 block text-xs text-[var(--color-muted)]">
                Auto-rejected candidates receive a &ldquo;Position has been
                filled&rdquo; email.
              </span>
            </span>
          </label>
        )}

        <DialogFooter className="mt-6 pt-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={working}
            className="rounded-[var(--radius-pill)] px-5"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={working}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
          >
            {working && <ButtonSpinner />}
            {working ? "Hiring…" : "Confirm Hire"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
