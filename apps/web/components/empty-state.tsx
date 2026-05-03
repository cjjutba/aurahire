import Link from "next/link";
import type { ReactNode } from "react";

type CtaProps =
  | { href: string; label: string }
  | { onClick: () => void; label: string };

interface EmptyStateProps {
  headline: string;
  description?: string;
  cta?: CtaProps;
  secondaryCta?: CtaProps;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({
  headline,
  description,
  cta,
  secondaryCta,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] py-16 px-6 text-center ${className ?? ""}`}
    >
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-soft)] text-[var(--color-muted)]">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-[var(--color-ink)]">
        {headline}
      </h3>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-body)]">
          {description}
        </p>
      )}
      {(cta || secondaryCta) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {cta && <CtaButton {...cta} variant="primary" />}
          {secondaryCta && <CtaButton {...secondaryCta} variant="outline" />}
        </div>
      )}
    </div>
  );
}

function CtaButton(
  props: CtaProps & { variant: "primary" | "outline" },
): ReactNode {
  const cls =
    props.variant === "primary"
      ? "inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 py-2 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
      : "inline-flex items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-6 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]";

  if ("href" in props) {
    return (
      <Link href={props.href} className={cls}>
        {props.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={props.onClick} className={cls}>
      {props.label}
    </button>
  );
}
