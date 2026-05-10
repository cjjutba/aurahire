import type { ReactNode } from "react";

interface SettingsSectionHeaderProps {
  title: string;
  subtitle?: string;
  /**
   * Right-aligned slot for primary actions (e.g. "Invite member" button on
   * the Members page). Optional.
   */
  actions?: ReactNode;
}

/**
 * The h2 + subtitle pair that opens every settings sub-route. Mirrors the
 * page-level header geometry from /recruiter/shortlist (h-2xl, normal weight,
 * tracking-tight, body-color subtitle) so the visual cadence matches the
 * rest of the recruiter portal.
 */
export function SettingsSectionHeader({
  title,
  subtitle,
  actions,
}: SettingsSectionHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-body)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
