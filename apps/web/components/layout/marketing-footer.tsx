export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--color-hairline)] bg-[var(--color-canvas)] py-12">
      <div className="mx-auto max-w-[1200px] px-6 text-center text-sm text-[var(--color-muted)]">
        <p>
          © {new Date().getFullYear()} AuraHire. Explainable AI-powered
          recruitment.
        </p>
      </div>
    </footer>
  );
}
