import Link from "next/link";

import { BrandWordmark } from "@/components/brand/brand-wordmark";

export function AuthFooter() {
  return (
    <footer className="border-t border-[var(--color-hairline-soft)] bg-[var(--color-canvas)] px-6 py-5 sm:px-8">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 text-xs">
        <BrandWordmark size="sm" />
        <nav className="flex items-center gap-5 text-[var(--color-body)]">
          <Link href="/legal/terms" className="hover:text-[var(--color-ink)] hover:underline">
            Terms of Use
          </Link>
          <span aria-hidden className="text-[var(--color-muted-soft)]">|</span>
          <Link href="/legal/privacy" className="hover:text-[var(--color-ink)] hover:underline">
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
