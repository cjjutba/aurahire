"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, AlertTriangle } from "lucide-react";

import { clientApiFetch } from "@/hooks/_client-fetch";
import { MEMBERSHIPS_QUERY_KEY } from "@/hooks/use-membership";
import { setActiveCompanyId } from "@/lib/active-company";
import { toastApiError, toastSuccess } from "@/lib/toast";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { InvitationPreview } from "@/lib/invitation-preview";

interface AcceptResponse {
  data: {
    companyId: string;
    companyName: string;
    role: "owner" | "admin" | "recruiter";
  };
}

const ROLE_LABEL: Record<InvitationPreview["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  recruiter: "Recruiter",
};

interface AcceptInvitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step =
  | { kind: "paste" }
  | { kind: "preview"; token: string; preview: InvitationPreview }
  | { kind: "error"; title: string; description: string };

/**
 * Sidebar-triggered modal that lets an authenticated recruiter paste an
 * invitation token, preview the workspace + role, and accept/decline without
 * leaving /recruiter. Mirrors the public /invite/[token] flow but stays in
 * the portal shell.
 */
export function AcceptInvitationDialog({
  open,
  onOpenChange,
}: AcceptInvitationDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>({ kind: "paste" });
  const [token, setToken] = useState("");
  const [pending, setPending] = useState<
    "lookup" | "accept" | "decline" | null
  >(null);

  function reset() {
    setStep({ kind: "paste" });
    setToken("");
    setPending(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleLookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed || pending) return;
    setPending("lookup");
    try {
      const res = await clientApiFetch<{ data: InvitationPreview }>(
        "/api/v1/invitations/preview",
        { query: { token: trimmed } },
      );
      const preview = res.data;
      if (preview.isExpired || preview.status !== "invited") {
        setStep({
          kind: "error",
          title: "Invitation expired",
          description:
            "This invitation has expired or has already been used. Ask the inviter to send a new one.",
        });
      } else {
        setStep({ kind: "preview", token: trimmed, preview });
      }
    } catch {
      setStep({
        kind: "error",
        title: "Invitation not found",
        description:
          "This invitation token is invalid. Double-check the string from your email and try again.",
      });
    } finally {
      setPending(null);
    }
  }

  async function handleAccept(activeToken: string) {
    if (pending) return;
    setPending("accept");
    try {
      const res = await clientApiFetch<AcceptResponse>(
        "/api/v1/invitations/accept",
        { method: "POST", body: { token: activeToken } },
      );
      setActiveCompanyId(res.data.companyId);
      // Drop everything cached for the previous company, then explicitly
      // pull memberships so the sidebar chip flips before we close.
      queryClient.clear();
      await queryClient.fetchQuery({
        queryKey: MEMBERSHIPS_QUERY_KEY,
        queryFn: () => clientApiFetch("/api/v1/profiles/me/memberships"),
      });
      toastSuccess(
        `You joined ${res.data.companyName}`,
        `Role: ${ROLE_LABEL[res.data.role]}`,
      );
      router.push("/recruiter");
      router.refresh();
      reset();
      onOpenChange(false);
    } catch (err) {
      toastApiError(err, "Couldn't accept invitation");
      setPending(null);
    }
  }

  async function handleDecline(activeToken: string) {
    if (pending) return;
    setPending("decline");
    try {
      await clientApiFetch("/api/v1/invitations/decline", {
        method: "POST",
        body: { token: activeToken },
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      toastApiError(err, "Couldn't decline invitation");
      setPending(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[480px] overflow-y-auto p-8">
        {step.kind === "paste" && (
          <PasteStep
            token={token}
            onTokenChange={setToken}
            pending={pending === "lookup"}
            onSubmit={handleLookup}
            onCancel={() => handleOpenChange(false)}
          />
        )}
        {step.kind === "preview" && (
          <PreviewStep
            preview={step.preview}
            pending={pending}
            onAccept={() => void handleAccept(step.token)}
            onDecline={() => void handleDecline(step.token)}
            onBack={reset}
          />
        )}
        {step.kind === "error" && (
          <ErrorStep
            title={step.title}
            description={step.description}
            onTryAgain={reset}
            onClose={() => handleOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface PasteStepProps {
  token: string;
  onTokenChange: (value: string) => void;
  pending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

function PasteStep({
  token,
  onTokenChange,
  pending,
  onSubmit,
  onCancel,
}: PasteStepProps) {
  const trimmed = token.trim();
  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-primary-soft)]">
            <Mail className="h-5 w-5 text-[var(--color-primary)]" aria-hidden />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-xl font-normal tracking-tight">
              Accept an invitation
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs">
              Paste the token from your email to join a team.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <label
        htmlFor="invite-token-modal"
        className="mt-6 block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-muted)]"
      >
        Invitation token
      </label>
      <textarea
        id="invite-token-modal"
        value={token}
        onChange={(e) => onTokenChange(e.target.value)}
        rows={4}
        placeholder="Paste the long string from your invitation email…"
        spellCheck={false}
        autoComplete="off"
        autoFocus
        className="mt-2 w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 py-3 font-[var(--font-mono)] text-[13px] text-[var(--color-ink)] outline-none transition-colors focus:border-2 focus:border-[var(--color-primary)] focus:px-[15px] focus:py-[11px]"
      />

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={pending}
          className="h-11 rounded-[var(--radius-pill)] border-[var(--color-hairline)] bg-[var(--color-surface-strong)] px-8 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-hairline)]"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={pending || trimmed.length === 0}
          className="h-11 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          {pending && <ButtonSpinner />}
          {pending ? "Looking up…" : "Continue"}
        </Button>
      </div>
    </form>
  );
}

interface PreviewStepProps {
  preview: InvitationPreview;
  pending: "lookup" | "accept" | "decline" | null;
  onAccept: () => void;
  onDecline: () => void;
  onBack: () => void;
}

function PreviewStep({
  preview,
  pending,
  onAccept,
  onDecline,
  onBack,
}: PreviewStepProps) {
  const initials = getInitials(preview.companyName);
  const daysRemaining = computeDaysRemaining(preview.expiresAt);
  const busy = pending !== null;

  return (
    <div>
      <DialogHeader>
        <DialogTitle className="sr-only">
          Invitation to {preview.companyName}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Review the invitation and accept or decline.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col items-center text-center">
        <Avatar className="h-16 w-16">
          {preview.companyLogoUrl ? (
            <AvatarImage src={preview.companyLogoUrl} alt="" />
          ) : null}
          <AvatarFallback className="bg-[var(--color-surface-strong)] text-base font-semibold text-[var(--color-ink)]">
            {initials}
          </AvatarFallback>
        </Avatar>
        <p className="mt-5 text-sm text-[var(--color-muted)]">
          You've been invited to join
        </p>
        <h2 className="mt-1 text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          {preview.companyName}
        </h2>
        <p className="mt-3 text-sm text-[var(--color-body)]">
          <strong className="font-semibold text-[var(--color-ink)]">
            {preview.inviterName}
          </strong>{" "}
          invited you as{" "}
          <strong className="font-semibold text-[var(--color-ink)]">
            {ROLE_LABEL[preview.role]}
          </strong>
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-muted)]">
          <span>Expires in {daysRemaining}</span>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <Button
          type="button"
          onClick={onAccept}
          disabled={busy}
          className="h-11 w-full rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          {pending === "accept" && <ButtonSpinner />}
          {pending === "accept" ? "Accepting…" : "Accept invitation"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onDecline}
          disabled={busy}
          className="h-11 w-full rounded-[var(--radius-pill)] border-[var(--color-hairline)] bg-[var(--color-canvas)] text-sm font-medium text-[var(--color-body)] hover:bg-[var(--color-surface-strong)]"
        >
          {pending === "decline" && <ButtonSpinner />}
          {pending === "decline" ? "Declining…" : "Decline"}
        </Button>
      </div>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="text-xs text-[var(--color-muted)] underline-offset-2 hover:text-[var(--color-ink)] hover:underline disabled:opacity-50"
        >
          Use a different token
        </button>
      </div>
    </div>
  );
}

interface ErrorStepProps {
  title: string;
  description: string;
  onTryAgain: () => void;
  onClose: () => void;
}

function ErrorStep({
  title,
  description,
  onTryAgain,
  onClose,
}: ErrorStepProps) {
  return (
    <div>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-score-mid-soft)]">
            <AlertTriangle
              className="h-5 w-5 text-[var(--color-score-mid)]"
              aria-hidden
            />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-xl font-normal tracking-tight">
              {title}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {description}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="h-11 rounded-[var(--radius-pill)] border-[var(--color-hairline)] bg-[var(--color-surface-strong)] px-6 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-hairline)]"
        >
          Close
        </Button>
        <Button
          type="button"
          onClick={onTryAgain}
          className="h-11 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          Try a different token
        </Button>
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function computeDaysRemaining(expiresAt: string): string {
  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) return "soon";
  const diffMs = expiresMs - Date.now();
  if (diffMs <= 0) return "soon";
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 1) return "less than a day";
  return `${days} days`;
}
