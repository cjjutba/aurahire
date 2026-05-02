"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

export function WithdrawButtonClient({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);

  async function withdraw() {
    if (!window.confirm("Withdraw this application? This cannot be undone.")) return;
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
        toast.error("Withdraw failed");
        return;
      }

      toast.success("Application withdrawn");
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
      Withdraw application
    </Button>
  );
}
