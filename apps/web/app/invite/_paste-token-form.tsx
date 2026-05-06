"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";

/**
 * Tiny client form that hands a pasted invitation token off to
 * /invite/[token] (which renders the preview + accept actions). The token
 * stays in the URL path on the next page so the preview is bookmarkable /
 * shareable in the same way email-sourced links are.
 */
export function PasteTokenForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) return;
    setSubmitting(true);
    router.push(`/invite/${encodeURIComponent(trimmed)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-[480px] rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-8 shadow-[0_4px_12px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-primary-soft)]">
          <Mail className="h-5 w-5 text-[var(--color-primary)]" aria-hidden />
        </div>
        <div>
          <h1 className="font-[var(--font-display)] text-[20px] font-normal tracking-[-0.3px] text-[var(--color-ink)]">
            Accept an invitation
          </h1>
          <p className="text-xs text-[var(--color-muted)]">
            Paste the token from your email to join a team.
          </p>
        </div>
      </div>

      <label
        htmlFor="invite-token"
        className="mt-6 block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-muted)]"
      >
        Invitation token
      </label>
      <textarea
        id="invite-token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        rows={4}
        placeholder="Paste the long string from your invitation email…"
        spellCheck={false}
        autoComplete="off"
        className="mt-2 w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 py-3 font-[var(--font-mono)] text-[13px] text-[var(--color-ink)] outline-none transition-colors focus:border-2 focus:border-[var(--color-primary)] focus:px-[15px] focus:py-[11px]"
      />

      <Button
        type="submit"
        disabled={submitting || token.trim().length === 0}
        className="mt-4 h-12 w-full rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-base font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
      >
        {submitting && <ButtonSpinner />}
        {submitting ? "Looking up…" : "Continue"}
      </Button>

      <p className="mt-4 text-center text-xs text-[var(--color-muted)]">
        Or paste the full link directly into your address bar.
      </p>
    </form>
  );
}
