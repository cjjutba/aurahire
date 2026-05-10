"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { getActiveCompanyId } from "@/lib/active-company";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { useConfirm } from "@/components/providers/confirm-provider";

interface Props {
  applicationId: string;
  initialShortlistedAt: string | null;
}

export function ShortlistButtonClient({
  applicationId,
  initialShortlistedAt,
}: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [shortlistedAt, setShortlistedAt] = useState<string | null>(
    initialShortlistedAt,
  );
  const [busy, setBusy] = useState(false);
  const isShortlisted = shortlistedAt !== null;

  async function authedFetch(
    path: string,
    init: RequestInit,
  ): Promise<Response> {
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

  async function toggle() {
    if (busy) return;
    const wasShortlisted = isShortlisted;
    const ok = await confirm({
      title: wasShortlisted ? "Remove from shortlist?" : "Add to shortlist?",
      description: wasShortlisted
        ? "The candidate will no longer appear on your shortlist. You can re-add them anytime."
        : "The candidate will be added to your shortlist for easier follow-up.",
      confirmLabel: wasShortlisted
        ? "Remove from shortlist"
        : "Add to shortlist",
      variant: wasShortlisted ? "destructive" : "info",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await authedFetch(
        `/api/v1/applications/${applicationId}/shortlist`,
        {
          method: wasShortlisted ? "DELETE" : "POST",
        },
      );
      if (!res.ok) {
        let message = wasShortlisted
          ? "Failed to remove from shortlist"
          : "Failed to add to shortlist";
        try {
          const body = (await res.json()) as { message?: string };
          if (body.message) message = body.message;
        } catch {
          // body wasn't JSON
        }
        throw new Error(message);
      }
      const body = (await res.json()) as {
        data: { shortlistedAt: string | null };
      };
      setShortlistedAt(body.data.shortlistedAt);
      toastSuccess(
        wasShortlisted ? "Removed from shortlist" : "Added to shortlist",
      );
      router.refresh();
    } catch (err) {
      toastApiError(
        err,
        wasShortlisted
          ? "Failed to remove from shortlist"
          : "Failed to add to shortlist",
      );
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
      aria-busy={busy}
      aria-label={isShortlisted ? "Remove from shortlist" : "Add to shortlist"}
      className={`${baseClasses} ${stateClasses}`}
    >
      {busy ? (
        <ButtonSpinner />
      ) : (
        <Star
          className={`h-4 w-4 ${isShortlisted ? "fill-current" : ""}`}
          aria-hidden
        />
      )}
      <span>
        {busy
          ? isShortlisted
            ? "Removing..."
            : "Adding..."
          : isShortlisted
            ? "Shortlisted"
            : "Shortlist"}
      </span>
    </button>
  );
}
