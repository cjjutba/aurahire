"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastApiError } from "@/lib/toast";
import type { JobStatus } from "@aurahire/shared";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
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
  const [working, setWorking] = useState(false);
  const [biasModalOpen, setBiasModalOpen] = useState(false);
  const [pendingFlags, setPendingFlags] = useState<BiasFlagChipFlag[]>([]);

  const inv = useInvalidate();
  const archiveMutation = useJobsControllerArchiveV1();

  async function publish() {
    setWorking(true);
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
      setWorking(false);
    }
  }

  async function archive() {
    if (!window.confirm("Archive this job? Candidates will no longer see it.")) return;
    setWorking(true);
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
      setWorking(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {status === "draft" && (
          <Button
            onClick={publish}
            disabled={working}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
          >
            {working && <ButtonSpinner />}
            {working ? "Publishing..." : "Publish"}
          </Button>
        )}
        {status !== "archived" && (
          <Button
            onClick={archive}
            disabled={working}
            variant="outline"
            className="rounded-[var(--radius-pill)]"
          >
            {working && <ButtonSpinner />}
            {working ? "Archiving..." : "Archive"}
          </Button>
        )}
      </div>

      <BiasOverrideModal
        jobId={id}
        flags={pendingFlags}
        open={biasModalOpen}
        onOpenChange={setBiasModalOpen}
        onAllResolved={() => {
          void publish();
        }}
      />
    </>
  );
}
