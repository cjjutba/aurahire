import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import type { InvitationPreview } from "@/lib/invitation-preview";

interface InvitePreviewCardProps {
  preview: InvitationPreview;
  /** Optional slot below the metadata (Accept/Decline buttons or sign-up CTA). */
  children?: React.ReactNode;
}

const ROLE_LABEL: Record<InvitationPreview["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  recruiter: "Recruiter",
};

/**
 * Server-renderable invite preview card. Used by both
 * /invite/[token] (public) and /onboarding/invite (auth-gated). Mirrors the
 * marketing feature-card visual language: hairline border, 24px radius,
 * generous padding, ink/body type pair.
 */
export function InvitePreviewCard({
  preview,
  children,
}: InvitePreviewCardProps) {
  const initials = getInitials(preview.companyName);
  const daysRemaining = computeDaysRemaining(preview.expiresAt);

  return (
    <div className="mx-auto w-full max-w-[480px] rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-8 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
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
        <h1 className="mt-1 font-[var(--font-display)] text-[28px] font-normal tracking-[-0.5px] text-[var(--color-ink)]">
          {preview.companyName}
        </h1>
        <p className="mt-3 text-sm text-[var(--color-body)]">
          <strong className="font-semibold text-[var(--color-ink)]">
            {preview.inviterName}
          </strong>{" "}
          invited you as{" "}
          <strong className="font-semibold text-[var(--color-ink)]">
            {ROLE_LABEL[preview.role]}
          </strong>
        </p>

        <div className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-muted)]">
          <span>Expires in {daysRemaining}</span>
        </div>
      </div>

      {children ? <div className="mt-8">{children}</div> : null}
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
