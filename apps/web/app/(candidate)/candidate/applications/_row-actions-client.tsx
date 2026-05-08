"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Loader2, Eye, XCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { useConfirm } from "@/components/providers/confirm-provider";

interface CandidateApplicationRowActionsProps {
  applicationId: string;
  status: string;
  jobTitle: string;
}

export function CandidateApplicationRowActionsClient({
  applicationId,
  status,
  jobTitle,
}: CandidateApplicationRowActionsProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function withdraw() {
    const ok = await confirm({
      title: `Withdraw application for ${jobTitle}?`,
      description:
        "This cannot be undone. You'll need to reapply if you change your mind.",
      confirmLabel: "Withdraw application",
      variant: "destructive",
    });
    if (!ok) return;

    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const res = await fetch(
        `${apiUrl}/api/v1/applications/${applicationId}/withdraw`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );

      if (!res.ok) throw new Error("Couldn't withdraw application");
      toastSuccess("Application withdrawn");
      router.refresh();
    } catch (err) {
      toastApiError(err, "Couldn't withdraw application");
    } finally {
      setBusy(false);
    }
  }

  const canWithdraw = !["hired", "rejected", "withdrawn"].includes(status);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={busy}
            aria-label={busy ? "Working..." : "Application actions"}
            aria-busy={busy}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-muted)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        }
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom">
        <DropdownMenuItem
          onClick={() => router.push(`/candidate/applications/${applicationId}`)}
          className="flex cursor-pointer items-center gap-2"
        >
          <Eye className="h-4 w-4" />
          View Details
        </DropdownMenuItem>
        {canWithdraw && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void withdraw()}
              disabled={busy}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <XCircle className="h-4 w-4" />
              Withdraw
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
