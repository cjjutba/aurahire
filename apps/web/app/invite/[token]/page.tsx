import { redirect } from "next/navigation";

import { getCurrentSession, getCurrentProfile } from "@/lib/auth/session";
import { fetchInvitationPreview } from "@/lib/invitation-preview";

import { InvitePreviewCard } from "@/components/invite/invite-preview-card";
import { InviteErrorCard } from "@/components/invite/invite-error-card";

import { PublicInviteActions } from "./_actions-client";
import { SignupRedirectForm } from "./_signup-redirect-form";

export const metadata = { title: "Invitation — AuraHire" };

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicInvitePage({ params }: PageProps) {
  const { token } = await params;

  const preview = await fetchInvitationPreview(token);

  if (!preview) {
    return (
      <InviteErrorCard
        title="Invitation not found"
        description="This invitation link is invalid or has already been used."
        ctaHref="/"
      />
    );
  }

  if (preview.isExpired || preview.status !== "invited") {
    return (
      <InviteErrorCard
        title="Invitation expired"
        description="This invitation has expired or has already been used. Ask the inviter to send a new one."
        ctaHref="/"
      />
    );
  }

  const session = await getCurrentSession();

  // Signed-out — set the cookie via server action and bounce to /register.
  if (!session) {
    return (
      <InvitePreviewCard preview={preview}>
        <SignupRedirectForm token={token} />
      </InvitePreviewCard>
    );
  }

  // Signed-in — verify the user is a recruiter (or admin). Candidates can't
  // join recruiter teams; we surface a clear error rather than silently
  // 403-ing on accept.
  const profile = (await getCurrentProfile()) as {
    id: string;
    role: string;
  } | null;

  if (!profile) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  if (profile.role !== "recruiter" && profile.role !== "admin") {
    return (
      <InviteErrorCard
        title="Recruiter accounts only"
        description="Team invitations are for recruiter accounts. Sign in with your recruiter account, or sign up as a recruiter to accept."
        ctaHref="/login"
        ctaLabel="Switch account"
      />
    );
  }

  return (
    <InvitePreviewCard preview={preview}>
      <PublicInviteActions token={token} />
    </InvitePreviewCard>
  );
}
