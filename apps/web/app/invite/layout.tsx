import Link from "next/link";

import { BrandWordmark } from "@/components/brand/brand-wordmark";

/**
 * Standalone shell for the public invite landing pages. Deliberately does NOT
 * use the recruiter portal layout — these pages must work for signed-out
 * users (who don't have a profile) and for candidates who happen to click an
 * invite link. Mirrors the visual rhythm of the auth shell.
 */
export default function InviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)]">
      <header className="border-b border-[var(--color-hairline-soft)] px-6 py-5 sm:px-8 sm:py-6">
        <Link href="/" aria-label="AuraHire home">
          <BrandWordmark size="md" />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-20">
        {children}
      </main>
    </div>
  );
}
