"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  AiProgressIndicator,
  PROFILE_SCORE_STAGES,
} from "@/components/ai/ai-progress-indicator";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { useConfirm } from "@/components/providers/confirm-provider";

export function RecomputeButtonClient() {
  const router = useRouter();
  const confirm = useConfirm();
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState(false);

  async function recompute() {
    const ok = await confirm({
      title: "Recompute your profile score?",
      description:
        "AI will rescore your profile against the latest weights. This replaces your current score and may take a few seconds.",
      confirmLabel: "Recompute score",
      variant: "warning",
    });
    if (!ok) return;
    setDone(false);
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

      // Snap the bar to 100% before the page refresh kicks in so the user
      // sees a definitive "Done" beat rather than the bar disappearing mid-roll.
      setDone(true);
      toastSuccess("Score recalculated");
      router.refresh();
    } finally {
      // Tiny delay so the 100% snap is perceptible before we tear the bar down.
      setTimeout(() => setWorking(false), 350);
    }
  }

  if (working) {
    return (
      <div className="w-[280px] max-w-full">
        <AiProgressIndicator stages={PROFILE_SCORE_STAGES} done={done} />
      </div>
    );
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
