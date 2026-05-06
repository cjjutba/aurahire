import Link from "next/link";
import { AlertCircle } from "lucide-react";

interface InviteErrorCardProps {
  title: string;
  description: string;
  /** Where the recover-CTA goes. Defaults to "/" when omitted. */
  ctaHref?: string;
  ctaLabel?: string;
}

/**
 * Shown when an invite token is unknown, consumed, or expired. Mirrors the
 * preview card geometry so the page rhythm doesn't shift between states.
 */
export function InviteErrorCard({
  title,
  description,
  ctaHref = "/",
  ctaLabel = "Back to AuraHire",
}: InviteErrorCardProps) {
  return (
    <div className="mx-auto w-full max-w-[480px] rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-8 text-center shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-score-mid-soft)]">
        <AlertCircle
          className="h-6 w-6 text-[var(--color-score-mid)]"
          aria-hidden
        />
      </div>
      <h1 className="mt-5 font-[var(--font-display)] text-[24px] font-normal tracking-[-0.4px] text-[var(--color-ink)]">
        {title}
      </h1>
      <p className="mt-3 text-sm text-[var(--color-body)]">{description}</p>
      <Link
        href={ctaHref}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-active)]"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
