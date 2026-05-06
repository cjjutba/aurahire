import { redirect } from "next/navigation";

import { getCurrentSession, getCurrentProfile } from "@/lib/auth/session";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { CompanyCreateForm } from "@/components/onboarding/recruiter/company-create-form";

export const metadata = { title: "Create Company — Onboarding" };

const STEPS = [
  { label: "Company" },
  { label: "About" },
  { label: "Focus" },
];

interface PageProps {
  searchParams: Promise<{ from?: string }>;
}

/**
 * Two flows render this page:
 *
 * 1. First-time signup, "Create" branch from /onboarding/start. Renders
 *    inside WizardShell as step 1; on success → /onboarding/recruiter.
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
    // "create another workspace" action.
    return (
      <div className="mx-auto w-full max-w-[720px] px-4 py-6 sm:py-8">
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 shadow-[0_4px_12px_rgba(0,0,0,0.04)] sm:p-8">
          <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
            Create a new workspace
          </h1>
          <p className="mt-2 text-sm text-[var(--color-body)]">
            You'll be the owner. You can switch between workspaces from the
            sidebar.
          </p>
          <div className="mt-6">
            <CompanyCreateForm mode="switcher" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <WizardShell
      title="About your company"
      description="Tell us who you'll be hiring for. You can edit any of this later in Settings."
      steps={STEPS}
      currentStep={1}
    >
      <CompanyCreateForm mode="onboarding" />
    </WizardShell>
  );
}
