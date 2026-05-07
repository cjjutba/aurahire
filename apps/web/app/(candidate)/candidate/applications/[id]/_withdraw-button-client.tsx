"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { useConfirm } from "@/components/providers/confirm-provider";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

export function WithdrawButtonClient({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [working, setWorking] = useState(false);

  async function withdraw() {
    const ok = await confirm({
      title: "Withdraw this application?",
      description:
        "This cannot be undone. You'll need to reapply if you change your mind.",
      confirmLabel: "Withdraw application",
      variant: "destructive",
    });
    if (!ok) return;
    setWorking(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const res = await fetch(
        `${apiUrl}/api/v1/applications/${applicationId}/withdraw`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );

      if (!res.ok) {
        toastApiError(null, "Couldn't withdraw application");
        return;
      }

      toastSuccess("Application withdrawn");
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  return (
    <Button
      onClick={withdraw}
      disabled={working}
      variant="outline"
      className="rounded-[var(--radius-pill)] border-[var(--color-status-danger)] text-[var(--color-status-danger)] hover:bg-[var(--color-status-danger)] hover:text-white"
    >
      {working && <ButtonSpinner />}
      {working ? "Withdrawing..." : "Withdraw application"}
    </Button>
  );
}
