"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Eye, Pencil, Send, Archive, Loader2 } from "lucide-react";
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

interface JobRowActionsClientProps {
  jobId: string;
  status: string;
}

export function JobRowActionsClient({ jobId, status }: JobRowActionsClientProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function getToken(): Promise<string | null> {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function handlePublish() {
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) {
        toastApiError(null, "Failed to publish", "Please sign in again.");
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const activeCompanyId = getActiveCompanyId();
      const res = await fetch(`${apiUrl}/api/v1/jobs/${jobId}/publish`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(activeCompanyId
            ? { "X-Active-Company-Id": activeCompanyId }
            : {}),
        },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toastApiError(
          null,
          "Failed to publish",
          body.message ?? `HTTP ${res.status}`,
        );
        return;
      }
      toastSuccess("Job published");
      router.refresh();
    } catch (err) {
      toastApiError(err, "Failed to publish");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) {
        toastApiError(null, "Failed to archive", "Please sign in again.");
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const activeCompanyId = getActiveCompanyId();
      const res = await fetch(`${apiUrl}/api/v1/jobs/${jobId}/archive`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(activeCompanyId
            ? { "X-Active-Company-Id": activeCompanyId }
            : {}),
        },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toastApiError(
          null,
          "Failed to archive",
          body.message ?? `HTTP ${res.status}`,
        );
        return;
      }
      toastSuccess("Job archived");
      router.refresh();
    } catch (err) {
      toastApiError(err, "Failed to archive");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={busy}
            aria-label={busy ? "Working..." : "Job actions"}
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
          onClick={() => router.push(`/recruiter/jobs/${jobId}`)}
          className="flex cursor-pointer items-center gap-2"
        >
          <Eye className="h-4 w-4" />
          View
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push(`/recruiter/jobs/${jobId}/edit`)}
          className="flex cursor-pointer items-center gap-2"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </DropdownMenuItem>

        {(status === "draft" || status !== "archived") && (
          <DropdownMenuSeparator />
        )}

        {status === "draft" && (
          <DropdownMenuItem
            onClick={() => void handlePublish()}
            disabled={busy}
            className="flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            Publish
          </DropdownMenuItem>
        )}

        {status !== "archived" && (
          <DropdownMenuItem
            onClick={() => void handleArchive()}
            disabled={busy}
            className="flex items-center gap-2"
          >
            <Archive className="h-4 w-4" />
            Archive
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
