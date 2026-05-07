import Link from "next/link";
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

export default async function LandingPage() {
  const profile = (await getCurrentProfile()) as { role?: string } | null;
  const dashboardHref = dashboardHrefFor(profile?.role);

  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-[840px] text-center">
        <span className="inline-block rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
          AI-Powered Recruitment
        </span>
        <h1 className="mt-6 text-5xl font-normal tracking-tight text-[var(--color-ink)] md:text-6xl">
          Hire fairly. Hire transparently. Hire faster.
        </h1>
        <p className="mx-auto mt-6 max-w-[600px] text-lg text-[var(--color-body)]">
          AuraHire pairs explainable AI scoring with built-in bias mitigation.
          See exactly why every candidate ranks where they do.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href={dashboardHref ?? "/register"}
            className="inline-flex h-12 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 text-base font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
          >
            {dashboardHref ? "Go to Dashboard" : "Get Started"}
          </Link>
          <Link
            href="/jobs"
            className="inline-flex h-12 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-8 text-base font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-surface-strong)]"
          >
            Browse Jobs
          </Link>
        </div>
      </div>
    </section>
  );
}
