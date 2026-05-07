import { redirect } from "next/navigation";

import { getCurrentSession, getCurrentProfile } from "@/lib/auth/session";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { CompanyCreateForm } from "@/components/onboarding/recruiter/company-create-form";
import { RECRUITER_ONBOARDING_STEPS } from "../_steps";

export const metadata = { title: "Create Company — Onboarding" };

interface PageProps {
  searchParams: Promise<{ from?: string }>;
}

/**
 * Two flows render this page:
 *
 * 1. First-time signup, "Create" branch from /onboarding/start. Renders
 *    inside OnboardingShell as the "company" step; on success → /onboarding/recruiter.
 *
 * 2. Existing recruiter creating an additional workspace via the sidebar's
 *    "Create new company" entry (?from=switcher). Renders bare (no wizard
 *    steps); on success the form switches the active company and lands on
 *    /recruiter.
 */
export default async function RecruiterCompanyCreatePage({
  searchParams,
}: PageProps) {
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
  const fromSwitcher = params.from === "switcher";

  if (fromSwitcher) {
    // No wizard chrome — the user is already onboarded; this is a one-off
    // "create another company" action. The sidebar usually opens this as a
    // modal; this page is a deep-linkable fallback.
    return (
      <div className="mx-auto w-full max-w-[720px] px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="font-[var(--font-display)] text-[26px] font-normal tracking-[-0.5px] text-[var(--color-ink)] sm:text-[28px]">
          Create a new company
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-body)]">
          You&apos;ll be the owner. You can switch between companies from the
          sidebar at any time.
        </p>
        <div className="mt-6">
          <CompanyCreateForm mode="switcher" />
        </div>
      </div>
    );
  }

  return (
    <OnboardingShell
      steps={RECRUITER_ONBOARDING_STEPS}
      currentStepId="company"
      saveStatus="idle"
      title="About your company"
      subtitle="Tell us who you'll be hiring for. You can edit any of this later in Settings."
    >
      <CompanyCreateForm mode="onboarding" />
    </OnboardingShell>
  );
}
