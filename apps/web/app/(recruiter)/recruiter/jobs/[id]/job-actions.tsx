"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Send } from "lucide-react";
import { toastSuccess, toastApiError } from "@/lib/toast";
import type { JobStatus } from "@aurahire/shared";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { useConfirm } from "@/components/providers/confirm-provider";
import { useJobsControllerArchiveV1 } from "@aurahire/shared";
import { useInvalidate } from "@/hooks/use-invalidate-queries";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { getActiveCompanyId } from "@/lib/active-company";
import { BiasOverrideModal } from "@/components/bias/bias-override-modal";
import type { BiasFlagChipFlag } from "@/components/bias/bias-flag-chip";

interface JobActionsProps {
  id: string;
  status: JobStatus;
}

export function JobActions({ id, status }: JobActionsProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [publishing, setPublishing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [biasModalOpen, setBiasModalOpen] = useState(false);
  const [pendingFlags, setPendingFlags] = useState<BiasFlagChipFlag[]>([]);

  const inv = useInvalidate();
  const archiveMutation = useJobsControllerArchiveV1();
  const busy = publishing || archiving;

  async function publish(skipConfirm = false) {
    if (!skipConfirm) {
      const ok = await confirm({
        title: "Publish this job?",
        description:
          "Candidates will be able to see and apply to this job. You can archive it later if needed.",
        confirmLabel: "Publish job",
        variant: "info",
      });
      if (!ok) return;
    }
    setPublishing(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toastApiError(null, "Couldn't publish job", "Please sign in again.");
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const activeCompanyId = getActiveCompanyId();
      // Publish takes no body; do NOT set Content-Type or Fastify will reject
      // with "Body cannot be empty when content-type is set to 'application/json'".
      const res = await fetch(`${apiUrl}/api/v1/jobs/${id}/publish`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          ...(activeCompanyId
            ? { "X-Active-Company-Id": activeCompanyId }
            : {}),
        },
      });

      if (res.status === 422) {
        const body = (await res.json()) as {
          message?: string;
          flags?: Array<{
            id: string;
            term: string;
            category: string;
            severity: "high" | "medium" | "low" | null;
            explanation: string | null;
            suggestion: string | null;
            status: "flagged" | "overridden" | "resolved";
          }>;
        };
        const flags = body.flags ?? [];
        setPendingFlags(
          flags.map((f) => ({
            id: f.id,
            term: f.term,
            category: f.category,
            severity: f.severity,
            explanation: f.explanation,
            suggestion: f.suggestion,
            status: f.status,
          })),
        );
        setBiasModalOpen(true);
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        toastApiError(null, "Couldn't publish job", body.message ?? `HTTP ${res.status}`);
        return;
      }

      toastSuccess("Job published");
      void inv.recruiterJobs();
      void inv.recruiterDashboard();
      void inv.candidateJobs();
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  async function archive() {
    const ok = await confirm({
      title: "Archive this job?",
      description: "Candidates will no longer see it. You can unarchive it later from your job list.",
      confirmLabel: "Archive job",
      variant: "destructive",
    });
    if (!ok) return;
    setArchiving(true);
    try {
      await archiveMutation.mutateAsync({ id });
      toastSuccess("Job archived");
      void inv.recruiterJobs();
      void inv.recruiterDashboard();
      void inv.candidateJobs();
      router.refresh();
    } catch (err) {
      toastApiError(err, "Couldn't archive job");
    } finally {
      setArchiving(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {status === "draft" && (
          <button
            type="button"
            onClick={() => void publish()}
            disabled={busy}
            className="inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)] disabled:cursor-not-allowed disabled:bg-[var(--color-primary-disabled)]"
          >
            {publishing ? (
              <>
                <ButtonSpinner />
                Publishing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Publish job
              </>
            )}
          </button>
        )}
        {status !== "archived" && (
          <button
            type="button"
            onClick={archive}
            disabled={busy}
            className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-5 text-sm font-medium text-[var(--color-status-danger)] transition hover:bg-[var(--color-score-low-soft)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {archiving ? (
              <>
                <ButtonSpinner />
                Archiving...
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" />
                Archive job
              </>
            )}
          </button>
        )}
      </div>

      <BiasOverrideModal
        jobId={id}
        flags={pendingFlags}
        open={biasModalOpen}
        onOpenChange={setBiasModalOpen}
        onAllResolved={() => {
          void publish(true);
        }}
      />
    </>
  );
}
