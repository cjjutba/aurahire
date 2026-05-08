"use client";

import { useActiveCompany } from "@/contexts/active-company-context";

/**
 * Fixed-position overlay rendered once at the recruiter layout level.
 * Mounts whenever a company switch is in flight and stays up until the
 * SSR transition settles (driven by `isSwitching` from the context).
 *
 * Visual: white-canvas blurred backdrop + centered card with an AuraHire
 * Blue ring spinner. Echoes the design-system "Score Ring" cadence
 * (800ms rotation, primary on primary-soft track) without being a Score
 * Ring — this is a process indicator, not an evaluation surface.
 */
export function CompanySwitchOverlay() {
  const ctx = useActiveCompany();
  if (!ctx?.isSwitching) return null;

  const name = ctx.pendingCompanyName ?? "company";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(255,255,255,0.72)] backdrop-blur-sm"
    >
      <div className="flex min-w-[260px] flex-col items-center gap-4 rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-8 py-6 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
        <Spinner aria-label="Loading" />
        <p className="text-center text-sm text-[var(--color-body)]">
          Switching to{" "}
          <span className="font-semibold text-[var(--color-ink)]">{name}</span>
          …
        </p>
      </div>
    </div>
  );
}

function Spinner({ "aria-label": label }: { "aria-label": string }) {
  return (
    <div aria-label={label} role="img" className="relative h-10 w-10">
      <div className="absolute inset-0 rounded-full border-[3px] border-[var(--color-primary-soft)]" />
      <div
        className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[var(--color-primary)]"
        style={{ animationDuration: "0.8s" }}
      />
    </div>
  );
}
