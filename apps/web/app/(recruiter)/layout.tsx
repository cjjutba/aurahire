import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { PortalShell } from "@/components/layout/portal-shell";
import { ActiveCompanyProvider } from "@/contexts/active-company-context";
import { CompanySwitchOverlay } from "@/components/layout/company-switch-overlay";

export default async function RecruiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = (await getCurrentProfile()) as
    | {
        id: string;
        role: string;
        fullName: string;
        email: string;
        avatarUrl: string | null;
        profileCompleted: boolean;
        // Phase 3: surfaced in the API response so we can seed the active
        // company singleton with the server-known value before the
        // memberships query resolves on the client.
        lastActiveCompanyId: string | null;
      }
    | null;

  if (!profile) redirect("/login");
  if (profile.role !== "recruiter" && profile.role !== "admin") {
    redirect("/login");
  }

  if (profile.role === "recruiter" && !profile.profileCompleted) {
    redirect("/onboarding/recruiter");
  }

  return (
    <ActiveCompanyProvider
      initialActiveCompanyId={profile.lastActiveCompanyId ?? null}
    >
      <CompanySwitchOverlay />
      <PortalShell
        role="recruiter"
        userId={profile.id}
        fullName={profile.fullName}
        email={profile.email}
        avatarUrl={profile.avatarUrl ?? null}
      >
        {children}
      </PortalShell>
    </ActiveCompanyProvider>
  );
}
