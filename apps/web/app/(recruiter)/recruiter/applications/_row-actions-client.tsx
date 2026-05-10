"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Loader2,
  Eye,
  UserCheck,
  Send,
  XCircle,
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

interface RecruiterApplicationRowActionsProps {
  applicationId: string;
  status: string;
  candidateName: string;
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

export function RecruiterApplicationRowActionsClient({
  applicationId,
  status,
  candidateName,
}: RecruiterApplicationRowActionsProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function patchStatus(
    newStatus: string,
    successMessage: string,
    errorMessage: string,
  ) {
    setBusy(true);
    try {
      const res = await authedFetch(
        `/api/v1/applications/${applicationId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newStatus, note: null }),
        },
      );
      if (!res.ok) throw new Error(errorMessage);
      toastSuccess(successMessage);
      router.refresh();
    } catch (err) {
      toastApiError(err, errorMessage);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    const ok = await confirm({
      title: `Reject ${candidateName}?`,
      description:
        "The candidate will be marked as rejected. You can change this later.",
      confirmLabel: "Reject candidate",
      variant: "destructive",
    });
    if (!ok) return;
    await patchStatus(
      "rejected",
      "Application rejected",
      "Couldn't reject application",
    );
  }

  async function moveToInterview() {
    const ok = await confirm({
      title: `Move ${candidateName} to Interview?`,
      description:
        "Advance this application to the Interview stage. The candidate will be notified.",
      confirmLabel: "Move to Interview",
      variant: "info",
    });
    if (!ok) return;
    await patchStatus(
      "interview",
      "Moved to Interview",
      "Couldn't move to interview",
    );
  }

  async function sendOffer() {
    const ok = await confirm({
      title: `Send offer to ${candidateName}?`,
      description:
        "Move this application to the Offer stage. The candidate will be notified.",
      confirmLabel: "Send Offer",
      variant: "info",
    });
    if (!ok) return;
    await patchStatus("offer", "Offer sent", "Couldn't send offer");
  }

  const terminal = ["hired", "rejected", "withdrawn"].includes(status);
  const canMoveToInterview =
    !terminal && status !== "interview" && status !== "offer";
  const canSendOffer = status === "interview";
  const canReject = !terminal;
  const showStatusActions = canMoveToInterview || canSendOffer;

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
          onClick={() =>
            router.push(`/recruiter/applications/${applicationId}`)
          }
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

        {canReject && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void reject()}
              disabled={busy}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
