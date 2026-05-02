"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { JobStatus } from "@aurahire/shared";
import { Button } from "@/components/ui/button";
import { useJobsControllerArchiveV1 } from "@aurahire/shared";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
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

  const archiveMutation = useJobsControllerArchiveV1();

  async function publish() {
    setWorking(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in again");
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const res = await fetch(`${apiUrl}/api/v1/jobs/${id}/publish`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
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
        toast.error("Publish failed", {
          description: body.message ?? `HTTP ${res.status}`,
        });
        return;
      }

      toast.success("Job published");
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
      toast.success("Job archived");
      router.refresh();
    } catch (err) {
      toast.error("Archive failed", {
        description: (err as Error).message,
      });
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
            Archive
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
