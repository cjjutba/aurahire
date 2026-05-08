"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { WithdrawApplicationModal } from "@/components/interview/withdraw-application-modal";

export function WithdrawButtonClient({ applicationId }: { applicationId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        className="rounded-[var(--radius-pill)] border-[var(--color-status-danger)] text-[var(--color-status-danger)] hover:bg-[var(--color-status-danger)] hover:text-white"
      >
        Withdraw application
      </Button>
      <WithdrawApplicationModal
        open={open}
        onOpenChange={setOpen}
        applicationId={applicationId}
      />
    </>
  );
}
