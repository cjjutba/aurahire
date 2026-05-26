import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { PortalShell } from "@/components/layout/portal-shell";

// Next.js 16 + Turbopack attempts to prerender pages under this layout
// at build time even though every server render here calls `cookies()`
// via `getCurrentProfile()`. Supabase's createServerClient throws
// synchronously on missing URL/key, which fails the Vercel prerender
// pass. Forcing dynamic rendering tells Next.js to skip prerender and
// render only at request time, when cookies and env vars are real.
export const dynamic = "force-dynamic";

export default async function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = (await getCurrentProfile()) as {
    id: string;
    role: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    profileCompleted: boolean;
  } | null;

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
