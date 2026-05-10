"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastApiError } from "@/lib/toast";
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
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/providers/confirm-provider";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

interface OfferRow {
  id: string;
  status: string;
  title: string;
  salary: number;
  salaryCurrency: string;
  startDate: string;
  expiresAt: string | null;
}

interface Props {
  offer: OfferRow;
}

export function OfferActionsClient({ offer }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [working, setWorking] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function authedPost(path: string, body?: object): Promise<Response> {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not signed in");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
    // Fastify rejects JSON Content-Type with empty body; only set the header
    // when we're actually sending JSON.
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    return fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async function accept() {
    const ok = await confirm({
      title: "Accept this offer?",
      description:
        "Your application status will move to Offer Accepted. Your recruiter will then confirm the hire.",
      confirmLabel: "Accept offer",
      variant: "info",
    });
    if (!ok) return;
    setWorking(true);
    try {
      const res = await authedPost(`/api/v1/offers/${offer.id}/accept`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toastApiError(null, "Couldn't accept offer", body.message);
        return;
      }
      toastSuccess(
        "Offer accepted",
        "Your recruiter will be in touch shortly to confirm next steps.",
      );
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  async function decline() {
    setWorking(true);
    try {
      const res = await authedPost(`/api/v1/offers/${offer.id}/decline`, {
        reason: reason.trim() || null,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toastApiError(null, "Couldn't decline offer", body.message);
        return;
      }
      toastSuccess("Offer declined");
      setDeclineOpen(false);
      setReason("");
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  if (offer.status !== "pending") {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        This offer is <strong>{offer.status}</strong>.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => void accept()}
          disabled={working}
          className="rounded-[var(--radius-pill)] bg-[var(--color-score-high)] text-white hover:opacity-90"
        >
          {working && <ButtonSpinner />}
          {working ? "Accepting..." : "Accept Offer"}
        </Button>
        <Button
          onClick={() => setDeclineOpen(true)}
          disabled={working}
          variant="outline"
          className="rounded-[var(--radius-pill)]"
        >
          Decline
        </Button>
      </div>

      <Dialog
        open={declineOpen}
        disablePointerDismissal={working}
        onOpenChange={(next) => {
          if (working && !next) return;
          setDeclineOpen(next);
        }}
      >
        <DialogContent className="max-w-md gap-0 p-6">
          <DialogHeader className="gap-2">
            <DialogTitle className="text-base font-semibold">
              Decline this offer?
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              You can tell the recruiter why — it helps them improve.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g., accepted another offer, role wasn't the right fit..."
            className="mt-4"
            disabled={working}
          />
          <DialogFooter className="mt-6 pt-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeclineOpen(false)}
              disabled={working}
              className="rounded-[var(--radius-pill)] px-5"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={decline}
              disabled={working}
              className="rounded-[var(--radius-pill)] bg-[var(--color-status-danger)] px-5 text-[var(--color-on-primary)] hover:opacity-90 active:opacity-95"
            >
              {working && <ButtonSpinner />}
              {working ? "Working…" : "Decline offer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
