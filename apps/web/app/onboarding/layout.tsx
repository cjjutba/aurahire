// apps/web/app/onboarding/layout.tsx
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthFooter } from "@/components/auth/auth-footer";
import { BrandWordmark } from "@/components/brand/brand-wordmark";
import { getCurrentProfile } from "@/lib/auth/session";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = (await getCurrentProfile()) as {
    id: string;
    role: string;
    profileCompleted: boolean;
  } | null;
  if (!profile) redirect("/login");

  // Candidates / recruiters who already finished onboarding never need to
  // re-enter the wizard. A back-button press from /candidate or a stale
  // bookmark would otherwise re-render the wizard's loading shells against
  // an already-complete profile. Send them forward to their portal home.
  if (profile.profileCompleted) {
    if (profile.role === "candidate") redirect("/candidate");
    if (profile.role === "recruiter") redirect("/recruiter");
    // Fall through for admin or unexpected roles — render the layout so any
    // unusual state surfaces normally rather than silently 302.
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)]">
      {/* Header — centered AuraHire wordmark, matches the auth shell. */}
      <header className="border-b border-[var(--color-hairline-soft)] bg-[var(--color-canvas)]">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-center px-4 sm:px-6">
          <Link href="/" aria-label="AuraHire home" className="inline-flex">
            <BrandWordmark size="md" />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      <AuthFooter />
    </div>
  );
}
