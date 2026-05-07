// apps/web/app/onboarding/layout.tsx
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthFooter } from "@/components/auth/auth-footer";
import { BrandWordmark } from "@/components/brand/brand-wordmark";
import { getCurrentProfile } from "@/lib/auth/session";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = (await getCurrentProfile()) as
    | { id: string; role: string; profileCompleted: boolean }
    | null;
  if (!profile) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)]">
      {/* Header — centered AuraHire wordmark, matches the auth shell. */}
      <header className="border-b border-[var(--color-hairline-soft)] bg-[var(--color-canvas)]">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-center px-4 sm:px-6">
          <Link href="/" aria-label="AuraHire home" className="inline-flex">
            <BrandWordmark size="md" />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      <AuthFooter />
    </div>
  );
}
