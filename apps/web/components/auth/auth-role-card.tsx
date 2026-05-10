import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

interface AuthRoleCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

export function AuthRoleCard({
  href,
  icon: Icon,
  title,
  description,
}: AuthRoleCardProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-6 py-4 transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/30"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-surface-strong)] text-[var(--color-body)] group-hover:bg-[var(--color-canvas)] group-hover:text-[var(--color-primary)]">
        <Icon className="size-4" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-[var(--color-ink)]">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-[var(--color-body)]">
          {description}
        </span>
      </span>
      <ChevronRight className="size-4 text-[var(--color-muted)]" />
    </Link>
  );
}
