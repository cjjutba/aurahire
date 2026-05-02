import { redirect } from "next/navigation";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { RecruiterCompanyForm } from "@/components/onboarding/recruiter/company-form";
import { getCurrentSession } from "@/lib/auth/session";

export const metadata = { title: "Company — Onboarding" };

const STEPS = [{ label: "About" }, { label: "Company" }, { label: "Focus" }];

type CompanySize = "1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1000+";

export default async function RecruiterCompanyPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/recruiter-profiles/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (res.status === 403) redirect("/login");
  if (!res.ok) {
    return (
      <div className="p-8 text-center text-[var(--color-status-danger)]">
        Failed to load profile.
      </div>
    );
  }

  const body = (await res.json()) as {
    data: {
      profileCompleted: boolean;
      company: {
        name: string;
        industry: string | null;
        size: string | null;
        website: string | null;
        headquartersLocation: string | null;
        description: string | null;
      };
    };
  };

  if (body.data.profileCompleted) redirect("/recruiter");

  return (
    <WizardShell
      title="About your company"
      description="Help candidates understand who they'd be joining."
      steps={STEPS}
      currentStep={2}
    >
      <RecruiterCompanyForm
        defaults={{
          companyName: body.data.company.name,
          industry: body.data.company.industry,
          size: body.data.company.size as CompanySize | null,
          website: body.data.company.website,
          headquartersLocation: body.data.company.headquartersLocation,
          description: body.data.company.description,
        }}
      />
    </WizardShell>
  );
}
