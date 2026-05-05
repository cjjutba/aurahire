"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

interface Props {
  applicationId: string;
  initialShortlistedAt: string | null;
}

export function ShortlistButtonClient({ applicationId, initialShortlistedAt }: Props) {
  const router = useRouter();
  const [shortlistedAt, setShortlistedAt] = useState<string | null>(initialShortlistedAt);
  const [busy, setBusy] = useState(false);
  const isShortlisted = shortlistedAt !== null;

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

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const wasShortlisted = isShortlisted;
    try {
      const res = await authedFetch(`/api/v1/applications/${applicationId}/shortlist`, {
        method: wasShortlisted ? "DELETE" : "POST",
      });
      if (!res.ok) {
        let message = wasShortlisted ? "Failed to remove from shortlist" : "Failed to add to shortlist";
        try {
          const body = (await res.json()) as { message?: string };
          if (body.message) message = body.message;
        } catch {
          // body wasn't JSON
        }
        throw new Error(message);
      }
      const body = (await res.json()) as { data: { shortlistedAt: string | null } };
      setShortlistedAt(body.data.shortlistedAt);
      toastSuccess(wasShortlisted ? "Removed from shortlist" : "Added to shortlist");
      router.refresh();
    } catch (err) {
      toastApiError(err, wasShortlisted ? "Failed to remove from shortlist" : "Failed to add to shortlist");
    } finally {
      setBusy(false);
    }
  }

  const baseClasses =
    "inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] border px-3 text-sm font-medium transition disabled:opacity-60";
  const stateClasses = isShortlisted
    ? "border-[var(--color-score-mid)] bg-[var(--color-score-mid-soft)] text-[var(--color-score-mid)] hover:opacity-90"
    : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-body)] hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={isShortlisted}
      aria-label={isShortlisted ? "Remove from shortlist" : "Add to shortlist"}
      className={`${baseClasses} ${stateClasses}`}
    >
      <Star
        className={`h-4 w-4 ${isShortlisted ? "fill-current" : ""}`}
        aria-hidden
      />
      <span>{isShortlisted ? "Shortlisted" : "Shortlist"}</span>
    </button>
  );
}
