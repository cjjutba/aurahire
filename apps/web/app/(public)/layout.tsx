import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { getCurrentProfile } from "@/lib/auth/session";

function dashboardHrefFor(role: string | null | undefined): string | null {
  switch (role) {
    case "candidate":
      return "/candidate";
    case "recruiter":
      return "/recruiter";
    case "admin":
      return "/admin";
    default:
      return null;
  }
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = (await getCurrentProfile()) as { role?: string } | null;
  const dashboardHref = dashboardHrefFor(profile?.role);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)]">
      <MarketingNav dashboardHref={dashboardHref} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
