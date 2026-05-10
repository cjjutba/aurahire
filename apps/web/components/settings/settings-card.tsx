import type { ReactNode } from "react";

interface SettingsCardProps {
  title?: string;
  description?: string;
  /**
   * Slot rendered to the right of the title (e.g. an audit-log timestamp,
   * a "Coming soon" badge, etc.).
   */
  trailing?: ReactNode;
  /**
   * Optional. Renders the card with the danger color tinting — used by
   * the leave/transfer/delete subsections.
   */
  tone?: "default" | "danger";
  children: ReactNode;
  className?: string;
}

/**
 * Hairline-bordered card wrapper used by every settings sub-route. Mirrors
 * the existing portal card geometry (rounded-lg, hairline border, white
 * canvas, p-6) — so a settings page reads as a stack of these.
 *
 * The `tone="danger"` variant swaps the hairline for the danger color,
 * which we use on the danger-zone subsections.
 */
export function SettingsCard({
  title,
  description,
  trailing,
  tone = "default",
  children,
  className,
}: SettingsCardProps) {
  const borderClass =
    tone === "danger"
      ? "border-[var(--color-status-danger)]"
      : "border-[var(--color-hairline)]";
  return (
    <section
      className={`rounded-[var(--radius-lg)] border ${borderClass} bg-[var(--color-canvas)] p-6 ${className ?? ""}`}
    >
      {(title || description || trailing) && (
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            {title ? (
              <h3 className="text-base font-semibold text-[var(--color-ink)]">
                {title}
              </h3>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-[var(--color-body)]">
                {description}
              </p>
            ) : null}
          </div>
          {trailing ? <div className="shrink-0">{trailing}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}
