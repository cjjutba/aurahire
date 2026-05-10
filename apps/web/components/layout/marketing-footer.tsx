import Link from "next/link";
import { BrandWordmark } from "@/components/brand/brand-wordmark";

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--color-hairline)] bg-[var(--color-canvas)] py-12">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-6 text-center text-sm text-[var(--color-muted)]">
        <BrandWordmark size="sm" />
        <nav
          aria-label="Legal"
          className="flex items-center gap-5 text-xs text-[var(--color-body)]"
        >
          <Link
            href="/legal/terms"
            className="transition-colors hover:text-[var(--color-ink)] hover:underline"
          >
            Terms of Service
          </Link>
          <span aria-hidden className="text-[var(--color-muted-soft)]">
            ·
          </span>
          <Link
            href="/legal/privacy"
            className="transition-colors hover:text-[var(--color-ink)] hover:underline"
          >
            Privacy Policy
          </Link>
        </nav>
        <p>
          © {new Date().getFullYear()} AuraHire. Explainable AI-powered
          recruitment.
        </p>
      </div>
    </footer>
  );
}
