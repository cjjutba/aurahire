import Link from "next/link";

import { AuthFooter } from "@/components/auth/auth-footer";
import { BrandWordmark } from "@/components/brand/brand-wordmark";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)]">
      <header className="border-b border-[var(--color-hairline-soft)] bg-[var(--color-canvas)]">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-center px-4 sm:px-6">
          <Link href="/" aria-label="AuraHire home" className="inline-flex">
            <BrandWordmark size="md" priority />
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <AuthFooter />
    </div>
  );
}
