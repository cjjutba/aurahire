import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentSession, getCurrentProfile } from "@/lib/auth/session";
import { fetchInvitationPreview } from "@/lib/invitation-preview";
import { PENDING_INVITE_COOKIE } from "@/lib/invite-cookie";

import { InvitePreviewCard } from "@/components/invite/invite-preview-card";
import { InviteErrorCard } from "@/components/invite/invite-error-card";

import { InviteActionsClient } from "./_invite-actions-client";

export const metadata = { title: "Accept Invitation — Onboarding" };

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

/**
 * Onboarding-flow accept/decline page. Token comes from either:
 *   1. ?token=… query param (when redirected here from /onboarding/start
 *      after the cookie was validated)
 *   2. pendingInviteToken cookie (when this page is hit directly with no
 *      query param — e.g. an authenticated user manually browsing here)
 *
 * Query-param wins when both are present.
 */
export default async function OnboardingInvitePage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const profile = (await getCurrentProfile()) as
    | { id: string; role: string }
    | null;
  if (!profile) redirect("/login");
  if (profile.role !== "recruiter" && profile.role !== "admin") {
    redirect("/login");
  }

  const params = await searchParams;
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(PENDING_INVITE_COOKIE)?.value;
  const token = params.token ?? cookieToken;

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-[480px] px-4 py-6 sm:py-10">
        <InviteErrorCard
          title="No invitation token"
          description="To join an existing team, you need an invitation token. Ask your teammate to send one, or create a new company instead."
          ctaHref="/onboarding/start"
          ctaLabel="Back to start"
        />
      </div>
    );
  }

  const preview = await fetchInvitationPreview(token);

  if (!preview || preview.isExpired || preview.status !== "invited") {
    return (
      <div className="mx-auto w-full max-w-[480px] px-4 py-6 sm:py-10">
        <InviteErrorCard
          title="Invitation expired"
          description="This invitation has expired or has already been used. Ask the inviter to send a new one."
          ctaHref="/onboarding/start"
          ctaLabel="Back to start"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-6 sm:py-10">
      <InvitePreviewCard preview={preview}>
        <InviteActionsClient token={token} />
      </InvitePreviewCard>
      <p className="mt-4 text-center text-xs text-[var(--color-muted)]">
        Wrong invitation?{" "}
        <Link
          href="/onboarding/start"
          className="text-[var(--color-primary)] hover:underline"
        >
          Go back
        </Link>
      </p>
    </div>
  );
}
