"use client";

import { useState } from "react";
import { toastSuccess, toastApiError } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { getActiveCompanyId } from "@/lib/active-company";
import type { BiasFlagChipFlag } from "./bias-flag-chip";

interface Props {
  jobId: string;
  flags: BiasFlagChipFlag[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAllResolved: () => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  gendered: "Gendered",
  "age-coded": "Age-coded",
  ableist: "Ableist",
  exclusionary: "Exclusionary",
  other: "Other",
};

export function BiasOverrideModal({
  jobId,
  flags,
  open,
  onOpenChange,
  onAllResolved,
}: Props) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [overridden, setOverridden] = useState<Record<string, boolean>>({});
  const [working, setWorking] = useState<Record<string, boolean>>({});

  const allOverridden =
    flags.length > 0 && flags.every((f) => f.id && overridden[f.id]);
  const remaining = flags.filter((f) => !(f.id && overridden[f.id]));

  async function overrideOne(flagId: string) {
    const reason = (reasons[flagId] ?? "").trim();
    if (reason.length < 10) {
      toastApiError(
        null,
        "Check your input",
        "Please provide a justification of at least 10 characters before overriding.",
      );
      return;
    }
    setWorking((p) => ({ ...p, [flagId]: true }));
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toastApiError(null, "Couldn't save override", "Please sign in again.");
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const activeCompanyId = getActiveCompanyId();
      const res = await fetch(
        `${apiUrl}/api/v1/bias/jobs/${jobId}/flags/${flagId}/override`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            ...(activeCompanyId
              ? { "X-Active-Company-Id": activeCompanyId }
              : {}),
          },
          body: JSON.stringify({ reason }),
        },
      );

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toastApiError(
          null,
          "Couldn't save override",
          body.message ?? `HTTP ${res.status}`,
        );
        return;
      }

      setOverridden((p) => ({ ...p, [flagId]: true }));
      toastSuccess("Override saved");
    } finally {
      setWorking((p) => ({ ...p, [flagId]: false }));
    }
  }

  function handleAllResolved() {
    onAllResolved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Bias Check, {flags.length} flag{flags.length === 1 ? "" : "s"}{" "}
            require attention
          </DialogTitle>
          <DialogDescription>
            Each flag must be overridden with a written reason (≥10 chars), or
            you can close this modal and edit the description instead.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto py-2">
          {flags.map((flag) => {
            if (!flag.id) return null;
            const isDone = overridden[flag.id] === true;
            return (
              <div
                key={flag.id}
                className={`rounded-[var(--radius-lg)] border p-4 ${
                  isDone
                    ? "border-[var(--color-score-high-soft)] bg-[var(--color-score-high-soft)]"
                    : "border-[var(--color-score-mid-soft)] bg-[var(--color-score-mid-soft)]"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold text-[var(--color-ink)]">
                    &ldquo;{flag.term}&rdquo;
                  </h3>
                  <span className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                    {CATEGORY_LABEL[flag.category] ?? flag.category}
                  </span>
                </div>
                {flag.explanation && (
                  <p className="mt-2 text-sm text-[var(--color-body)]">
                    {flag.explanation}
                  </p>
                )}
                {flag.suggestion && (
                  <p className="mt-2 text-xs text-[var(--color-body)]">
                    <span className="font-semibold">Suggested:</span>{" "}
                    {flag.suggestion}
                  </p>
                )}
                {isDone ? (
                  <p className="mt-3 text-sm font-semibold text-[var(--color-score-high)]">
                    ✓ Overridden
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      value={reasons[flag.id] ?? ""}
                      onChange={(e) =>
                        setReasons((p) => ({
                          ...p,
                          [flag.id!]: e.target.value,
                        }))
                      }
                      placeholder="Why is this term acceptable for this job? (≥10 characters)"
                      rows={2}
                    />
                    <Button
                      onClick={() => overrideOne(flag.id!)}
                      disabled={
                        working[flag.id] ||
                        (reasons[flag.id] ?? "").trim().length < 10
                      }
                      className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 py-1 text-xs text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
                    >
                      {working[flag.id] && <ButtonSpinner />}
                      {working[flag.id]
                        ? "Saving..."
                        : "Override with this reason"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-[var(--radius-pill)]"
          >
            Edit description instead
          </Button>
          <Button
            onClick={handleAllResolved}
            disabled={!allOverridden}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
          >
            {allOverridden
              ? "Continue with publish"
              : `${remaining.length} remaining`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
