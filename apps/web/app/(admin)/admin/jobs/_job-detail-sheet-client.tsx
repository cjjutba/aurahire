"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastApiError } from "@/lib/toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { useConfirm } from "@/components/providers/confirm-provider";
import { BiasFlagsList } from "@/components/bias/bias-flags-list";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

interface DetailBiasFlag {
  id: string;
  term: string;
  category: string;
  severity: string | null;
  status: "flagged" | "overridden" | "resolved";
  overrideReason: string | null;
  overriddenAt: string | null;
  createdAt: string;
}

interface Detail {
  id: string;
  title: string;
  status: string;
  description: string;
  descriptionPlain: string;
  requiredSkills: string[];
  recruiter: { id: string; fullName: string; email: string };
  company: { id: string; name: string };
  biasFlags: DetailBiasFlag[];
}

interface Props {
  jobId: string;
  open: boolean;
  onClose: () => void;
}

export function JobDetailSheetClient({ jobId, open, onClose }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const res = await fetch(`${apiUrl}/api/v1/admin/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      if (!res.ok || cancelled) return;
      const body = (await res.json()) as { data: Detail };
      if (!cancelled) setDetail(body.data);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  async function archive() {
    if (!detail) return;
    const ok = await confirm({
      title: "Archive this job?",
      description:
        "Candidates will no longer see it in search results. You can review archived jobs in the admin job list.",
      confirmLabel: "Archive job",
      variant: "destructive",
    });
    if (!ok) return;
    setWorking(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toastApiError(null, "Couldn't archive job", "Please sign in again.");
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const res = await fetch(`${apiUrl}/api/v1/admin/jobs/${jobId}/archive`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        toastApiError(null, "Couldn't archive job");
        return;
      }
      toastSuccess("Job archived");
      router.refresh();
      onClose();
    } finally {
      setWorking(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full overflow-y-auto bg-[var(--color-canvas)] sm:max-w-2xl"
      >
        <SheetHeader>
          <SheetTitle>{detail?.title ?? "Loading…"}</SheetTitle>
        </SheetHeader>
        {detail && (
          <div className="mt-6 space-y-6 px-4 pb-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Recruiter
              </p>
              <p className="mt-1 text-sm text-[var(--color-ink)]">
                {detail.recruiter.fullName} · {detail.recruiter.email}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Company
              </p>
              <p className="mt-1 text-sm text-[var(--color-ink)]">
                {detail.company.name}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Description
              </p>
              <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm text-[var(--color-body)]">
                {detail.descriptionPlain}
              </p>
            </div>
            {detail.biasFlags.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Bias Flag History
                </p>
                <div className="mt-2">
                  <BiasFlagsList
                    flags={detail.biasFlags.map((f) => ({
                      id: f.id,
                      term: f.term,
                      category: f.category,
                      severity: f.severity as "high" | "medium" | "low" | null,
                      status: f.status,
                      explanation: null,
                      suggestion: null,
                    }))}
                    title={`${detail.biasFlags.length} flag${
                      detail.biasFlags.length === 1 ? "" : "s"
                    } on record`}
                  />
                </div>
                {detail.biasFlags
                  .filter((f) => f.status === "overridden")
                  .map((f) => (
                    <div
                      key={f.id}
                      className="mt-2 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] p-3 text-xs"
                    >
                      <strong>&ldquo;{f.term}&rdquo;</strong> overridden —{" "}
                      {f.overrideReason}
                    </div>
                  ))}
              </div>
            )}
            <div className="border-t border-[var(--color-hairline)] pt-4">
              {detail.status !== "archived" && (
                <Button
                  onClick={archive}
                  disabled={working}
                  className="rounded-[var(--radius-pill)] bg-[var(--color-status-danger)]"
                >
                  {working && <ButtonSpinner />}
                  {working ? "Archiving…" : "Archive job"}
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
