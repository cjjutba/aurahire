"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { FEEDBACK_STATUS, type FeedbackStatus } from "@aurahire/shared";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { toastApiError, toastSuccess } from "@/lib/toast";

import type { FeedbackRow } from "./page";

interface Props {
  entryId: string;
  open: boolean;
  onClose: () => void;
}

const STATUS_DOT: Record<FeedbackStatus, string> = {
  new: "bg-[var(--color-status-info)]",
  reviewing: "bg-[var(--color-status-warning)]",
  resolved: "bg-[var(--color-status-success)]",
  dismissed: "bg-[var(--color-muted)]",
};

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export function FeedbackDetailSheetClient({ entryId, open, onClose }: Props) {
  const router = useRouter();
  const [detail, setDetail] = useState<FeedbackRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pending edits stay local until "Save changes" — lets the admin queue
  // both a status change and a note tweak in one mutation, matching the
  // PATCH endpoint's combined update shape.
  const [pendingStatus, setPendingStatus] = useState<FeedbackStatus | null>(
    null,
  );
  const [pendingNote, setPendingNote] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setDetail(null);
      setError(null);
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Not signed in");
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const res = await fetch(`${apiUrl}/api/v1/admin/feedback/${entryId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      if (cancelled) return;
      if (!res.ok) {
        setError(`Failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as { data: FeedbackRow };
      if (cancelled) return;
      setDetail(body.data);
      setPendingStatus(body.data.status);
      setPendingNote(body.data.adminNote ?? "");
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  const dirty =
    detail !== null &&
    (pendingStatus !== detail.status ||
      (pendingNote.trim() || null) !== (detail.adminNote ?? null));

  async function save() {
    if (!detail || !dirty || saving || !pendingStatus) return;
    setSaving(true);
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
      const body: Record<string, unknown> = {};
      if (pendingStatus !== detail.status) body.status = pendingStatus;
      const trimmedNote = pendingNote.trim() === "" ? null : pendingNote.trim();
      if (trimmedNote !== (detail.adminNote ?? null)) {
        body.adminNote = trimmedNote;
      }

      const res = await fetch(`${apiUrl}/api/v1/admin/feedback/${entryId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toastApiError(null, "Couldn't update feedback", errBody.message);
        return;
      }
      const updated = (await res.json()) as { data: FeedbackRow };
      setDetail(updated.data);
      setPendingStatus(updated.data.status);
      setPendingNote(updated.data.adminNote ?? "");
      toastSuccess("Feedback updated");
      router.refresh();
    } catch (err) {
      toastApiError(err, "Couldn't update feedback");
    } finally {
      setSaving(false);
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
          <SheetTitle>{detail ? detail.subject : "Loading…"}</SheetTitle>
          {detail ? (
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {detail.type.toUpperCase()}
              {detail.severity ? ` · ${detail.severity.toUpperCase()}` : ""}
              {" · "}
              {new Date(detail.createdAt).toLocaleString()}
            </p>
          ) : null}
        </SheetHeader>

        {error ? (
          <p className="mx-4 mt-6 text-sm text-[var(--color-status-danger)]">
            {error}
          </p>
        ) : null}

        {!detail && !error ? (
          <Skeleton className="mx-4 mt-6 h-32 rounded-[var(--radius-lg)]" />
        ) : null}

        {detail ? (
          <div className="mt-2 space-y-6 px-4 pb-8">
            {/* Submitter */}
            <section className="space-y-1">
              <SectionLabel>Submitter</SectionLabel>
              <p className="text-sm text-[var(--color-ink)]">
                <strong>{detail.submitter.fullName}</strong>{" "}
                <span className="text-[var(--color-muted)]">
                  · {detail.submitter.role}
                </span>
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                {detail.submitter.email}
              </p>
              {detail.company ? (
                <p className="text-xs text-[var(--color-muted)]">
                  Company: {detail.company.name}
                </p>
              ) : null}
            </section>

            {/* Message */}
            <section className="space-y-1">
              <SectionLabel>Message</SectionLabel>
              <p className="whitespace-pre-wrap rounded-[var(--radius-md)] border border-[var(--color-hairline-soft)] bg-[var(--color-surface-soft)] p-3 text-sm text-[var(--color-ink)]">
                {detail.message}
              </p>
            </section>

            {/* Context */}
            <section className="space-y-1">
              <SectionLabel>Auto-captured context</SectionLabel>
              {detail.pageUrl ? (
                <p className="break-all text-xs text-[var(--color-body)]">
                  Page:{" "}
                  <a
                    href={detail.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                  >
                    {detail.pageUrl}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              ) : null}
              {detail.userAgent ? (
                <p className="break-all text-xs text-[var(--color-muted)]">
                  UA: {detail.userAgent}
                </p>
              ) : null}
              {detail.appVersion ? (
                <p className="text-xs text-[var(--color-muted)]">
                  Version: {detail.appVersion}
                </p>
              ) : null}
              {!detail.pageUrl && !detail.userAgent && !detail.appVersion ? (
                <p className="text-xs text-[var(--color-muted-soft)]">
                  No client context captured.
                </p>
              ) : null}
            </section>

            {/* Status changer */}
            <section className="space-y-2">
              <SectionLabel>Status</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_STATUS.map((s) => {
                  const selected = pendingStatus === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPendingStatus(s)}
                      className={[
                        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-sm transition",
                        selected
                          ? "bg-[var(--color-ink)] text-[var(--color-on-dark)]"
                          : "bg-[var(--color-surface-strong)] text-[var(--color-ink)] hover:bg-[var(--color-hairline)]",
                      ].join(" ")}
                      aria-pressed={selected}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[s]}`}
                        aria-hidden
                      />
                      {STATUS_LABEL[s]}
                    </button>
                  );
                })}
              </div>
              {detail.resolvedAt && pendingStatus === detail.status ? (
                <p className="text-xs text-[var(--color-muted)]">
                  Resolved {new Date(detail.resolvedAt).toLocaleString()}
                </p>
              ) : null}
            </section>

            {/* Admin note */}
            <section className="space-y-2">
              <SectionLabel>Internal note</SectionLabel>
              <textarea
                value={pendingNote}
                onChange={(e) => setPendingNote(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="Add an internal note (visible to admins only)…"
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </section>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-[var(--color-hairline-soft)] pt-4">
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={saving}
                className="rounded-[var(--radius-pill)]"
              >
                Close
              </Button>
              <Button
                onClick={save}
                disabled={!dirty || saving}
                className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary)]/90"
              >
                {saving ? <ButtonSpinner /> : null}
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
      {children}
    </h3>
  );
}
