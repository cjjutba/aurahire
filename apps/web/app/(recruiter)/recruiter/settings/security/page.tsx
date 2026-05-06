import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { SecurityPasswordForm } from "@/components/settings/security-form";

export const metadata = { title: "Security · Settings" };

interface ProfileBody {
  data: { email: string };
}

/**
 * The Security section reuses the recruiter-profiles endpoint solely to
 * resolve the caller's email — Supabase Auth does not expose `getUser()`
 * in a server-component-friendly form without round-tripping the JWT,
 * and the backend's profile DTO is the most direct source.
 */
export default async function RecruiterSettingsSecurityPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/recruiter-profiles/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  const email = res.ok ? ((await res.json()) as ProfileBody).data.email : "";

  return (
    <>
      <SettingsSectionHeader
        title="Security"
        subtitle="Manage how you sign in and protect your account."
      />

      <SettingsCard
        title="Change password"
        description="You'll be asked to confirm your current password before saving."
      >
        <SecurityPasswordForm email={email} />
      </SettingsCard>

      <SettingsCard
        title="Active sessions"
        description="Sign out of every device you're currently signed in on."
        trailing={<ComingSoonBadge />}
      >
        <p className="text-sm text-[var(--color-body)]">
          Session management will be wired up in a future release. For now,
          signing out from the user menu in the sidebar revokes the current
          device's session.
        </p>
      </SettingsCard>

      <SettingsCard
        title="Two-factor authentication"
        description="Add a one-time code from an authenticator app to every sign-in."
        trailing={<ComingSoonBadge />}
      >
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-[var(--color-body)]">
            Two-factor authentication is on the roadmap. The toggle below is
            disabled until the integration ships.
          </p>
          {/* Toggle placeholder — visually inert, semantically a disabled checkbox */}
          <span
            aria-disabled="true"
            className="relative inline-flex h-6 w-11 cursor-not-allowed items-center rounded-full bg-[var(--color-surface-strong)] opacity-60"
          >
            <span className="ml-1 inline-block h-4 w-4 rounded-full bg-[var(--color-canvas)] shadow" />
          </span>
        </div>
      </SettingsCard>
    </>
  );
}

function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
      Coming soon
    </span>
  );
}
