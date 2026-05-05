import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { PortalShell } from "@/components/layout/portal-shell";

export default async function AdminLayout({
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
  if (profile.role !== "admin") redirect("/login");

  return (
    <PortalShell
      role="admin"
      fullName={profile.fullName}
      email={profile.email}
      companyName={null}
    >
      {children}
    </PortalShell>
  );
}
