import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { getCurrentProfile } from "@/lib/auth/session";

// Public marketing routes read cookies via `getCurrentProfile()` so the
// nav can render a "Go to dashboard" link for signed-in users. That
// makes them dynamic by definition; force the marker so Next.js 16
// skips prerender (where Supabase env vars aren't loaded).
export const dynamic = "force-dynamic";

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
