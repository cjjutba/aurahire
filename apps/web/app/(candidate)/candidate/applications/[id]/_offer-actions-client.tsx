"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  const [working, setWorking] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function authedPost(path: string, body?: object): Promise<Response> {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not signed in");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
    return fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async function accept() {
    setWorking(true);
    try {
      const res = await authedPost(`/api/v1/offers/${offer.id}/accept`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error("Accept failed", { description: body.message });
        return;
      }
      toast.success("Offer accepted — welcome aboard!");
      setAcceptOpen(false);
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
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error("Decline failed", { description: body.message });
        return;
      }
      toast.success("Offer declined");
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
          onClick={() => setAcceptOpen(true)}
          disabled={working}
          className="rounded-[var(--radius-pill)] bg-[var(--color-score-high)] text-white hover:opacity-90"
        >
          Accept Offer
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

      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Accept this offer?</DialogTitle>
            <DialogDescription>
              Your application status will move to <strong>Hired</strong> and the recruiter will be
              notified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAcceptOpen(false)}
              className="rounded-[var(--radius-pill)]"
              disabled={working}
            >
              Cancel
            </Button>
            <Button
              onClick={accept}
              disabled={working}
              className="rounded-[var(--radius-pill)] bg-[var(--color-score-high)] text-white hover:opacity-90"
            >
              {working ? "Accepting..." : "Confirm accept"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Decline this offer?</DialogTitle>
            <DialogDescription>
              Optional: tell the recruiter why (helps them improve).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g., accepted another offer, role wasn't the right fit..."
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeclineOpen(false)}
              className="rounded-[var(--radius-pill)]"
              disabled={working}
            >
              Cancel
            </Button>
            <Button
              onClick={decline}
              disabled={working}
              className="rounded-[var(--radius-pill)] bg-[var(--color-status-danger)] text-white hover:opacity-90"
            >
              {working ? "Declining..." : "Confirm decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
