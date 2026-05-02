"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

const NEXT_STATUSES: Record<string, string[]> = {
  applied: ["screening", "rejected"],
  screening: ["interview", "rejected"],
  interview: ["offer", "rejected"],
  offer: ["hired", "rejected"],
  hired: [],
  rejected: [],
  withdrawn: [],
};

const STATUS_LABELS: Record<string, string> = {
  screening: "Move to Screening",
  interview: "Move to Interview",
  offer: "Send Offer",
  hired: "Mark Hired",
  rejected: "Reject",
};

interface Props {
  applicationId: string;
  currentStatus: string;
  currentNotes: string;
}

export function ApplicationActionsClient({
  applicationId,
  currentStatus,
  currentNotes,
}: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState(currentNotes);
  const [working, setWorking] = useState(false);
  const nextStatuses = NEXT_STATUSES[currentStatus] ?? [];

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

  async function changeStatus(newStatus: string) {
    setWorking(true);
    try {
      const res = await authedFetch(`/api/v1/applications/${applicationId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus }),
      });
      if (!res.ok) {
        toast.error("Status change failed");
        return;
      }
      toast.success(`Moved to ${newStatus}`);
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  async function saveNotes() {
    setWorking(true);
    try {
      const res = await authedFetch(`/api/v1/applications/${applicationId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes || null }),
      });
      if (!res.ok) {
        toast.error("Save notes failed");
        return;
      }
      toast.success("Notes saved");
    } finally {
      setWorking(false);
    }
  }

  async function downloadResume() {
    setWorking(true);
    try {
      const res = await authedFetch(
        `/api/v1/applications/${applicationId}/resume-download`,
        {
          method: "GET",
        },
      );
      if (!res.ok) {
        toast.error("Download failed");
        return;
      }
      const body = (await res.json()) as { data: { signedUrl: string } };
      window.open(body.data.signedUrl, "_blank");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="space-y-6 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        Actions
      </h2>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={downloadResume}
          disabled={working}
          variant="outline"
          className="rounded-[var(--radius-pill)]"
        >
          Download Resume
        </Button>
        {nextStatuses.map((s) => (
          <Button
            key={s}
            onClick={() => changeStatus(s)}
            disabled={working}
            className={`rounded-[var(--radius-pill)] text-[var(--color-on-primary)] ${
              s === "rejected"
                ? "bg-[var(--color-status-danger)] hover:bg-[var(--color-status-danger)]"
                : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-active)]"
            }`}
          >
            {STATUS_LABELS[s] ?? s}
          </Button>
        ))}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-ink)]">
          Recruiter notes
        </label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Notes for your team — visible only to recruiters"
        />
        <Button
          onClick={saveNotes}
          disabled={working}
          className="mt-3 rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          Save notes
        </Button>
      </div>
    </section>
  );
}
