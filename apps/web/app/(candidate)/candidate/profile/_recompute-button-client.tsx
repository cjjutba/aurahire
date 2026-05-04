"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { AiShimmer } from "@/components/ai/ai-shimmer";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

export function RecomputeButtonClient() {
  const router = useRouter();
  const [working, setWorking] = useState(false);

  async function recompute() {
    setWorking(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const res = await fetch(`${apiUrl}/api/v1/scoring/profile/compute`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.status === 429) {
        toastApiError(null, "Couldn't recalculate", "Please wait a moment before recalculating.");
        return;
      }

      if (!res.ok) {
        toastApiError(null, "Couldn't recalculate");
        return;
      }

      toastSuccess("Score recalculated");
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  if (working) {
    return <AiShimmer caption="Recomputing your Profile Score..." height={80} />;
  }

  return (
    <Button
      onClick={recompute}
      variant="outline"
      className="rounded-[var(--radius-pill)]"
    >
      Recompute
    </Button>
  );
}
