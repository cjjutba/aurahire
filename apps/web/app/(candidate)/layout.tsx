import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { PortalShell } from "@/components/layout/portal-shell";

export default async function CandidateLayout({
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
      }
    | null;

  if (!profile) redirect("/login");
  if (profile.role !== "candidate" && profile.role !== "admin") {
    redirect("/login");
  }

  if (profile.role === "candidate" && !profile.profileCompleted) {
    redirect("/onboarding/candidate");
  }

  return (
    <PortalShell
      role="candidate"
      userId={profile.id}
      fullName={profile.fullName}
      email={profile.email}
      avatarUrl={profile.avatarUrl ?? null}
    >
      {children}
    </PortalShell>
  );
}
