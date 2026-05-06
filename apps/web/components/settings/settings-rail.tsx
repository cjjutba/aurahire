"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

export interface SettingsRailItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export interface SettingsRailGroup {
  /**
   * Group heading. Rendered in the same uppercase muted style as the
   * portal sidebar section labels.
   */
  label: string;
  items: SettingsRailItem[];
}

interface SettingsRailProps {
  groups: SettingsRailGroup[];
}

/**
 * Two-mode nav for /recruiter/settings/* and /candidate/settings/*:
 *   - desktop (≥ lg): a 256px left rail rendered as a `<nav>` column
 *   - mobile  (< lg): a horizontal scrolling tab strip across the top
 *
 * Active state matches the existing portal-sidebar item style — primary-soft
 * background + primary text — so a settings sub-route looks visually
 * continuous with the outer nav.
 *
 * The two rendering modes are mounted simultaneously and visibility-toggled
 * via Tailwind, so the `usePathname()` value is shared and there is no
 * mode-switch flash.
 */
export function SettingsRail({ groups }: SettingsRailProps) {
  const pathname = usePathname();
  const allHrefs = groups.flatMap((g) => g.items.map((i) => i.href));
  const activeHref = resolveActiveHref(pathname, allHrefs);

  return (
    <>
      {/* Desktop rail */}
      <nav
        aria-label="Settings sections"
        className="hidden w-64 shrink-0 lg:block"
      >
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = activeHref === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        "flex h-9 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm transition",
                        isActive
                          ? "bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]"
                          : "text-[var(--color-body)] hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]",
                      ].join(" ")}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* Mobile horizontal tab strip */}
      <nav
        aria-label="Settings sections"
        className="-mx-4 mb-2 overflow-x-auto border-b border-[var(--color-hairline)] lg:hidden"
      >
        <div className="flex min-w-max items-center gap-1 px-4">
          {groups.flatMap((group) =>
            group.items.map((item) => {
              const isActive = activeHref === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-[var(--radius-md)] px-3 text-sm transition",
                    isActive
                      ? "bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]"
                      : "text-[var(--color-body)] hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              );
            }),
          )}
        </div>
      </nav>
    </>
  );
}

function resolveActiveHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (!matches) continue;
    if (best === null || href.length > best.length) {
      best = href;
    }
  }
  return best;
}
