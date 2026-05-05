"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

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
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${session.access_token}`,
    },
  });
}

export function ShortlistRowActionsClient({
  applicationId,
  status,
}: ShortlistRowActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function moveToInterview() {
    setBusy(true);
    setOpen(false);
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
    setBusy(true);
    setOpen(false);
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
    setBusy(true);
    setOpen(false);
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

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        aria-label="Row actions"
        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-muted)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)] disabled:opacity-50"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 min-w-[180px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
          {/* View */}
          <Link
            href={`/recruiter/applications/${applicationId}`}
            onClick={() => setOpen(false)}
            className="flex w-full items-center px-4 py-2.5 text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
          >
            View
          </Link>

          {/* Move to Interview */}
          {canMoveToInterview && (
            <button
              type="button"
              disabled={busy}
              onClick={moveToInterview}
              className="flex w-full items-center px-4 py-2.5 text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)] disabled:opacity-50"
            >
              Move to Interview
            </button>
          )}

          {/* Send Offer */}
          {canSendOffer && (
            <button
              type="button"
              disabled={busy}
              onClick={sendOffer}
              className="flex w-full items-center px-4 py-2.5 text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)] disabled:opacity-50"
            >
              Send Offer
            </button>
          )}

          <div className="my-1 border-t border-[var(--color-hairline-soft)]" />

          {/* Remove from Shortlist — destructive */}
          <button
            type="button"
            disabled={busy}
            onClick={removeFromShortlist}
            className="flex w-full items-center px-4 py-2.5 text-sm text-[var(--color-status-danger)] hover:bg-[var(--color-surface-soft)] disabled:opacity-50"
          >
            Remove from Shortlist
          </button>
        </div>
      )}
    </div>
  );
}
