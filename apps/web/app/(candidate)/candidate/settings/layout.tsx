import type { ReactNode } from "react";

import { CandidateSettingsRail } from "@/components/settings/candidate-settings-rail";

export const metadata = { title: "Settings" };

/**
 * Candidate settings shell. Same geometry as the recruiter shell -
 * 256px rail + content column, but only the Personal group ships
 * because candidates have no multi-tenancy.
 */
export default function CandidateSettingsLayout({
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
          Manage your profile, sign-in, notifications, and privacy.
        </p>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row">
        <CandidateSettingsRail />
        <main className="min-w-0 flex-1">
          <div className="max-w-3xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
