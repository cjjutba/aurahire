import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Building2, Mail } from "lucide-react";

import { getCurrentSession, getCurrentProfile } from "@/lib/auth/session";
import { fetchMyMemberships } from "@/lib/memberships-server";
import { fetchInvitationPreview } from "@/lib/invitation-preview";
import { PENDING_INVITE_COOKIE } from "@/lib/invite-cookie";

export const metadata = { title: "Get started, AuraHire" };

/**
 * The pre-step "create vs join" fork. Reached on:
 *   1. First-time recruiter signup landing here directly
 *   2. Cookie-driven redirect after signup-via-invite-link
 *
 * Routing decisions, in order:
 *   - No session → /login
 *   - Profile not loaded yet → /login (lets the auth callback re-trigger)
 *   - Candidate role → /onboarding/candidate (wrong wizard for this role)
 *   - Membership count >= 1 → /recruiter (no fork needed; user already has
 *     a workspace)
 *   - pendingInviteToken cookie present + valid → /onboarding/invite?token=…
 *     (the token from the email survives signup; we fast-forward to it)
 *   - Otherwise → render the two-card chooser
 */
export default async function OnboardingStartPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const profile = (await getCurrentProfile()) as {
    id: string;
    role: string;
  } | null;
  if (!profile) redirect("/login");

  if (profile.role === "candidate") redirect("/onboarding/candidate");
  if (profile.role !== "recruiter" && profile.role !== "admin") {
    redirect("/login");
  }

  const memberships = await fetchMyMemberships(session.access_token);
  const activeMemberships = memberships.filter((m) => m.status === "active");

  if (activeMemberships.length >= 1) {
    redirect("/recruiter");
  }

  // Cookie-driven invite fast-path. Validate the token before redirecting so
  // we don't bounce the user to a dead invite preview.
  const cookieStore = await cookies();
  const pendingToken = cookieStore.get(PENDING_INVITE_COOKIE)?.value;
  if (pendingToken) {
    const preview = await fetchInvitationPreview(pendingToken);
    if (preview && !preview.isExpired && preview.status === "invited") {
      redirect(`/onboarding/invite?token=${encodeURIComponent(pendingToken)}`);
    }
    // Stale cookie, do nothing here; /onboarding/invite is the page that
    // owns clearing it. Surfacing the chooser is the right fallback.
  }

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-12 sm:py-16">
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
          Get started
        </p>
        <h1 className="mt-3 font-[var(--font-display)] text-[36px] font-normal tracking-[-0.5px] text-[var(--color-ink)] sm:text-[44px]">
          How do you want to start?
        </h1>
        <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-relaxed text-[var(--color-body)]">
          Set up a new company for your team, or accept an invitation if a
          teammate already invited you.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <ChoiceCard
          href="/onboarding/recruiter/company-create"
          icon={
            <Building2
              className="h-6 w-6 text-[var(--color-primary)]"
              aria-hidden
            />
          }
          title="Create a new company"
          description="Set up a company for your team. You'll be the owner and can invite teammates after."
        />
        <ChoiceCard
          href="/onboarding/invite"
          icon={
            <Mail className="h-6 w-6 text-[var(--color-primary)]" aria-hidden />
          }
          title="Join my team"
          description="You have an invitation token from a teammate or email link. Paste it on the next step."
        />
      </div>
    </div>
  );
}

function ChoiceCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-7 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-primary-soft)]">
        {icon}
      </div>
      <h2 className="mt-5 text-lg font-semibold text-[var(--color-ink)]">
        {title}
      </h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--color-body)]">
        {description}
      </p>
      <span className="mt-5 text-sm font-semibold text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5">
        Continue →
      </span>
    </Link>
  );
}
