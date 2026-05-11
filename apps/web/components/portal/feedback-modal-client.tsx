"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bug,
  HelpCircle,
  Lightbulb,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import type { FeedbackSeverity, FeedbackType } from "@aurahire/shared";

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
import { toastApiError, toastSuccess } from "@/lib/toast";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { getActiveCompanyId } from "@/lib/active-company";

const TYPE_OPTIONS: Array<{
  value: FeedbackType;
  label: string;
  icon: typeof Bug;
}> = [
  { value: "bug", label: "Bug", icon: Bug },
  { value: "suggestion", label: "Suggestion", icon: Lightbulb },
  { value: "question", label: "Question", icon: HelpCircle },
  { value: "praise", label: "Praise", icon: Sparkles },
  { value: "other", label: "Other", icon: MessageCircle },
];

const SEVERITY_OPTIONS: Array<{ value: FeedbackSeverity; label: string }> = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

const SUBJECT_MAX = 120;
const MESSAGE_MAX = 4000;
const SUBJECT_MIN = 3;
const MESSAGE_MIN = 10;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function FeedbackModalClient({ open, onOpenChange }: Props) {
  const [type, setType] = useState<FeedbackType>("suggestion");
  const [severity, setSeverity] = useState<FeedbackSeverity>("normal");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset on close so the next open is fresh, avoids accidentally
  // re-submitting a previous draft after a successful send.
  useEffect(() => {
    if (!open) {
      setType("suggestion");
      setSeverity("normal");
      setSubject("");
      setMessage("");
      setSubmitting(false);
    }
  }, [open]);

  const subjectTrimmed = subject.trim();
  const messageTrimmed = message.trim();
  const isValid =
    subjectTrimmed.length >= SUBJECT_MIN &&
    subjectTrimmed.length <= SUBJECT_MAX &&
    messageTrimmed.length >= MESSAGE_MIN &&
    messageTrimmed.length <= MESSAGE_MAX;

  const pageUrl = useMemo(
    () => (typeof window === "undefined" ? null : window.location.href),
    // Snapshot once when modal first mounts; if the user navigates while
    // the modal is open we'd rather keep the URL they triggered from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );

  async function submit() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toastApiError(null, "Sign-in required");
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const activeCompanyId = getActiveCompanyId();
      const userAgent =
        typeof navigator === "undefined" ? null : navigator.userAgent;
      const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? null;

      const res = await fetch(`${apiUrl}/api/v1/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...(activeCompanyId
            ? { "X-Active-Company-Id": activeCompanyId }
            : {}),
        },
        body: JSON.stringify({
          type,
          severity: type === "bug" ? severity : undefined,
          subject: subjectTrimmed,
          message: messageTrimmed,
          pageUrl,
          userAgent,
          appVersion,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toastApiError(null, "Couldn't send feedback", body.message);
        return;
      }

      toastSuccess("Thanks, feedback sent", "We read every submission.");
      onOpenChange(false);
    } catch (err) {
      toastApiError(err, "Couldn't send feedback");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>
            Tell us what&apos;s working, what&apos;s broken, or what would make
            AuraHire better. Your message goes straight to the team.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-5">
          {/* Type */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Type
            </label>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-sm transition",
                      selected
                        ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                        : "bg-[var(--color-surface-strong)] text-[var(--color-ink)] hover:bg-[var(--color-hairline)]",
                    ].join(" ")}
                    aria-pressed={selected}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Severity (only when type === "bug") */}
          {type === "bug" ? (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Severity
              </label>
              <div className="flex flex-wrap gap-2">
                {SEVERITY_OPTIONS.map((opt) => {
                  const selected = severity === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSeverity(opt.value)}
                      className={[
                        "rounded-[var(--radius-pill)] px-3 py-1.5 text-sm transition",
                        selected
                          ? "bg-[var(--color-ink)] text-[var(--color-on-dark)]"
                          : "bg-[var(--color-surface-strong)] text-[var(--color-ink)] hover:bg-[var(--color-hairline)]",
                      ].join(" ")}
                      aria-pressed={selected}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Subject */}
          <div>
            <label
              htmlFor="feedback-subject"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]"
            >
              Subject
            </label>
            <input
              id="feedback-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={SUBJECT_MAX}
              placeholder="One sentence summary"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
            <CharCounter
              current={subjectTrimmed.length}
              min={SUBJECT_MIN}
              max={SUBJECT_MAX}
            />
          </div>

          {/* Message */}
          <div>
            <label
              htmlFor="feedback-message"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]"
            >
              Message
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={MESSAGE_MAX}
              placeholder={
                type === "bug"
                  ? "What did you do? What did you expect? What happened?"
                  : "Share as much detail as you'd like."
              }
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
            <CharCounter
              current={messageTrimmed.length}
              min={MESSAGE_MIN}
              max={MESSAGE_MAX}
            />
          </div>

          {/* Auto-context disclosure */}
          <p className="text-[11px] text-[var(--color-muted)]">
            We&apos;ll attach the current page URL and your browser info so we
            can reproduce issues faster.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="rounded-[var(--radius-pill)]"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!isValid || submitting}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary)]/90"
          >
            {submitting ? <ButtonSpinner /> : null}
            {submitting ? "Sending…" : "Send feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CharCounter({
  current,
  min,
  max,
}: {
  current: number;
  min: number;
  max: number;
}) {
  const remaining = min - current;
  const belowMin = remaining > 0;
  return (
    <div className="mt-1 flex items-center justify-between text-[11px]">
      <span
        className={
          belowMin
            ? "text-[var(--color-status-danger)]"
            : "text-[var(--color-muted)]"
        }
      >
        {belowMin
          ? `Need ${remaining} more character${remaining === 1 ? "" : "s"}`
          : `Min ${min}`}
      </span>
      <span className="text-[var(--color-muted)]">
        {current} / {max}
      </span>
    </div>
  );
}
