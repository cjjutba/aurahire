"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Loader2,
  Eye,
  UserCheck,
  Send,
  StarOff,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { getActiveCompanyId } from "@/lib/active-company";
import { useConfirm } from "@/components/providers/confirm-provider";

interface ShortlistRowActionsProps {
  applicationId: string;
  status: string;
}

async function authedFetch(path: string, init: RequestInit): Promise<Response> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const activeCompanyId = getActiveCompanyId();
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${session.access_token}`,
      ...(activeCompanyId ? { "X-Active-Company-Id": activeCompanyId } : {}),
    },
  });
}

export function ShortlistRowActionsClient({
  applicationId,
  status,
}: ShortlistRowActionsProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function moveToInterview() {
    const ok = await confirm({
      title: "Move to Interview?",
      description:
        "Advance this application to the Interview stage. The candidate will be notified.",
      confirmLabel: "Move to Interview",
      variant: "info",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await authedFetch(`/api/v1/applications/${applicationId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus: "interview", note: null }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toastSuccess("Moved to Interview");
      router.refresh();
    } catch (err) {
      toastApiError(err, "Couldn't move to interview");
    } finally {
      setBusy(false);
    }
  }

  async function sendOffer() {
    const ok = await confirm({
      title: "Send Offer?",
      description:
        "Move this application to the Offer stage. The candidate will be notified.",
      confirmLabel: "Send Offer",
      variant: "info",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await authedFetch(`/api/v1/applications/${applicationId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus: "offer", note: null }),
      });
      if (!res.ok) throw new Error("Failed to send offer");
      toastSuccess("Offer sent");
      router.refresh();
    } catch (err) {
      toastApiError(err, "Couldn't send offer");
    } finally {
      setBusy(false);
    }
  }

  async function removeFromShortlist() {
    const ok = await confirm({
      title: "Remove from shortlist?",
      description:
        "The candidate will no longer appear on your shortlist. You can re-add them anytime.",
      confirmLabel: "Remove from shortlist",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await authedFetch(`/api/v1/applications/${applicationId}/shortlist`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove from shortlist");
      toastSuccess("Removed from shortlist");
      router.refresh();
    } catch (err) {
      toastApiError(err, "Couldn't remove from shortlist");
    } finally {
      setBusy(false);
    }
  }

  const terminal = ["hired", "rejected", "withdrawn"].includes(status);
  const canMoveToInterview = !terminal && status !== "interview" && status !== "offer";
  const canSendOffer = status === "interview";
  const showStatusActions = canMoveToInterview || canSendOffer;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={busy}
            aria-label={busy ? "Working..." : "Row actions"}
            aria-busy={busy}
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
          onClick={() => router.push(`/recruiter/applications/${applicationId}`)}
          className="flex cursor-pointer items-center gap-2"
        >
          <Eye className="h-4 w-4" />
          View
        </DropdownMenuItem>

        {showStatusActions && <DropdownMenuSeparator />}

        {canMoveToInterview && (
          <DropdownMenuItem
            onClick={() => void moveToInterview()}
            disabled={busy}
            className="flex items-center gap-2"
          >
            <UserCheck className="h-4 w-4" />
            Move to Interview
          </DropdownMenuItem>
        )}

        {canSendOffer && (
          <DropdownMenuItem
            onClick={() => void sendOffer()}
            disabled={busy}
            className="flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            Send Offer
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => void removeFromShortlist()}
          disabled={busy}
          variant="destructive"
          className="flex items-center gap-2"
        >
          <StarOff className="h-4 w-4" />
          Remove from Shortlist
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
