"use client";

import { useRouter } from "next/navigation";
import type { ReactNode, KeyboardEvent, MouseEvent } from "react";

interface ClickableRowProps {
  href: string;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}

const INTERACTIVE_SELECTOR =
  'a, button, [role="menuitem"], [role="menu"], [role="dialog"], [data-stop-row-click], input, select, textarea, label';

export function ClickableRow({
  href,
  ariaLabel,
  children,
  className = "",
}: ClickableRowProps) {
  const router = useRouter();

  function handleClick(e: MouseEvent<HTMLTableRowElement>) {
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    router.push(href);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(href);
    }
  }

  return (
    <tr
      role="link"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`cursor-pointer transition hover:bg-[var(--color-surface-soft)] focus:bg-[var(--color-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)] ${className}`}
    >
      {children}
    </tr>
  );
}
