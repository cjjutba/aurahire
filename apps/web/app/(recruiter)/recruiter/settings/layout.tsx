import type { ReactNode } from "react";

import { RecruiterSettingsRail } from "@/components/settings/recruiter-settings-rail";

export const metadata = { title: "Settings" };

/**
 * Two-column layout for /recruiter/settings/*.
 *
 *   ┌──────────────┬───────────────────────────────────────────────┐
 *   │  RAIL  256px │  active section content (max-w-3xl)            │
 *   └──────────────┴───────────────────────────────────────────────┘
 *
 * Below 1024px the rail collapses to a horizontal scrolling tab strip
 * rendered above the content (handled inside <SettingsRail/>). Both modes
 * share a single nav component, visibility is toggled via Tailwind
 * breakpoints, so route changes feel continuous.
 *
 * The header (`Settings` h1 + subtitle) is rendered once at the layout
 * level so each sub-route only owns its own h2 + body. Server-rendered
 * because the rail itself is the only client island here.
 */
export default function RecruiterSettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Settings
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          Manage your personal account and the workspaces you belong to.
        </p>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row">
        <RecruiterSettingsRail />
        <main className="min-w-0 flex-1">
          <div className="max-w-3xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
