import { BrandWordmark } from "@/components/brand/brand-wordmark";

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--color-hairline)] bg-[var(--color-canvas)] py-12">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-3 px-6 text-center text-sm text-[var(--color-muted)]">
        <BrandWordmark size="sm" />
        <p>
          © {new Date().getFullYear()} AuraHire. Explainable AI-powered
          recruitment.
        </p>
      </div>
    </footer>
  );
}
