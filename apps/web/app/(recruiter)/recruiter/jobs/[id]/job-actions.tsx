"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { JobStatus } from "@aurahire/shared";
import { Button } from "@/components/ui/button";
import {
  useJobsControllerPublishV1,
  useJobsControllerArchiveV1,
} from "@aurahire/shared";

interface JobActionsProps {
  id: string;
  status: JobStatus;
}

export function JobActions({ id, status }: JobActionsProps) {
  const router = useRouter();
  const [working, setWorking] = useState(false);

  const publishMutation = useJobsControllerPublishV1();
  const archiveMutation = useJobsControllerArchiveV1();

  async function publish() {
    setWorking(true);
    try {
      await publishMutation.mutateAsync({ id });
      toast.success("Job published");
      router.refresh();
    } catch (err) {
      toast.error("Publish failed", {
        description: (err as Error).message,
      });
    } finally {
      setWorking(false);
    }
  }

  async function archive() {
    if (
      !window.confirm(
        "Archive this job? Candidates will no longer see it.",
      )
    )
      return;
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
    <div className="flex items-center gap-2">
      {status === "draft" && (
        <Button
          onClick={publish}
          disabled={working}
          className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-active)]"
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
  );
}
