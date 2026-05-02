import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { PortalShell } from "@/components/layout/portal-shell";

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
        profileCompleted: boolean;
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
    <PortalShell
      role="recruiter"
      fullName={profile.fullName}
      email={profile.email}
    >
      {children}
    </PortalShell>
  );
}
