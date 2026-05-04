"use client";

import { useEffect, useRef, useState } from "react";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

const POLL_INTERVAL_MS = 2000;
const DEFAULT_SAMPLE_SIZE = 50;

interface JobStatus {
  queueJobId: string;
  state: "waiting" | "active" | "completed" | "failed" | "delayed" | "paused" | "unknown";
  progress: number;
  processedOn: string | null;
  finishedOn: string | null;
  result: {
    processedCount: number;
    skippedCount: number;
    failedCount: number;
    durationMs: number;
  } | null;
  failedReason: string | null;
}

async function authedFetch(path: string, init?: RequestInit) {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${session.access_token}`,
    },
  });
}

export function ApplyToExistingClient() {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [enqueueWorking, setEnqueueWorking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  async function pollOnce(queueJobId: string) {
    try {
      const res = await authedFetch(`/api/v1/admin/queue/jobs/${queueJobId}/status`);
      if (!res.ok) {
        toastApiError(null, "Couldn't check rescore status");
        stopPolling();
        return;
      }
      const body = (await res.json()) as { data: JobStatus };
      setStatus(body.data);

      if (body.data.state === "completed") {
        stopPolling();
        const r = body.data.result;
        toastSuccess("Rescore complete", `${r?.processedCount ?? 0} applications updated.`);
      } else if (body.data.state === "failed") {
        stopPolling();
        toastApiError(null, "Couldn't complete rescore", body.data.failedReason ?? "(no reason)");
      } else if (body.data.state === "unknown") {
        stopPolling();
        toastApiError(null, "Couldn't complete rescore", "Check the audit log for completion details.");
      }
    } catch (err) {
      stopPolling();
      toastApiError(err, "Couldn't complete rescore");
    }
  }

  async function enqueue() {
    if (
      !window.confirm(
        `Re-score the last ${DEFAULT_SAMPLE_SIZE} applications with current weights? This creates new match_scores rows; original scores remain for audit. Cannot be undone.`,
      )
    ) {
      return;
    }

    setEnqueueWorking(true);
    setStatus(null);
    try {
      const res = await authedFetch("/api/v1/admin/queue/rescore-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleSize: DEFAULT_SAMPLE_SIZE }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        toastApiError(null, "Couldn't queue rescore", body.message ?? "Queue may be unavailable. Verify Redis is running.");
        return;
      }
      const body = (await res.json()) as {
        data: { queueJobId: string; queueName: string; sampleSize: number; enqueuedAt: string };
      };
      const initialStatus: JobStatus = {
        queueJobId: body.data.queueJobId,
        state: "waiting",
        progress: 0,
        processedOn: null,
        finishedOn: null,
        result: null,
        failedReason: null,
      };
      setStatus(initialStatus);
      toastSuccess("Rescore queued");

      stopPolling();
      void pollOnce(body.data.queueJobId);
      intervalRef.current = setInterval(() => {
        void pollOnce(body.data.queueJobId);
      }, POLL_INTERVAL_MS);
    } finally {
      setEnqueueWorking(false);
    }
  }

  if (
    status &&
    (status.state === "waiting" || status.state === "active" || status.state === "delayed")
  ) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">
          Re-scoring in progress
        </h3>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Queue job{" "}
          <code className="rounded bg-[var(--color-surface-soft)] px-1 font-mono">
            {status.queueJobId}
          </code>{" "}
          · state: <strong>{status.state}</strong>
        </p>
        <div className="mt-4 h-2 w-full rounded-[var(--radius-pill)] bg-[var(--color-primary-soft)]">
          <div
            className="h-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] transition-all duration-500"
            style={{ width: `${status.progress}%` }}
          />
        </div>
        <p className="mt-2 text-right font-mono text-xs text-[var(--color-muted)]">
          {status.progress}%
        </p>
      </div>
    );
  }

  if (status && status.state === "completed" && status.result) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-score-high-soft)] bg-[var(--color-score-high-soft)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-score-high)]">
          Re-score complete
        </h3>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          <strong className="font-mono">{status.result.processedCount}</strong> processed ·{" "}
          <strong className="font-mono">{status.result.skippedCount}</strong> skipped ·{" "}
          <strong className="font-mono">{status.result.failedCount}</strong> failed in{" "}
          <strong className="font-mono">{status.result.durationMs}ms</strong>
        </p>
        <div className="mt-4">
          <Button
            onClick={enqueue}
            variant="outline"
            className="rounded-[var(--radius-pill)]"
          >
            Run again
          </Button>
        </div>
      </div>
    );
  }

  if (status && status.state === "failed") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-status-danger)] bg-[var(--color-score-low-soft)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-status-danger)]">
          Re-score failed
        </h3>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          {status.failedReason ?? "(no reason recorded)"}
        </p>
        <div className="mt-4">
          <Button
            onClick={enqueue}
            variant="outline"
            className="rounded-[var(--radius-pill)]"
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      onClick={enqueue}
      disabled={enqueueWorking}
      className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-active)]"
    >
      {enqueueWorking && <ButtonSpinner />}
      {enqueueWorking
        ? "Enqueueing..."
        : `Apply weights to existing scores (last ${DEFAULT_SAMPLE_SIZE})`}
    </Button>
  );
}
