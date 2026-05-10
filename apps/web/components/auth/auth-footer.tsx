import Link from "next/link";

export function AuthFooter() {
  return (
    <footer className="border-t border-[var(--color-hairline-soft)] bg-[var(--color-canvas)] px-6 py-5 sm:px-8">
      <nav className="mx-auto flex max-w-[1200px] items-center justify-center gap-5 text-xs text-[var(--color-body)]">
        <Link
          href="/legal/terms"
          className="transition-colors hover:text-[var(--color-ink)] hover:underline"
        >
          Terms of Service
        </Link>
        <span aria-hidden className="text-[var(--color-muted-soft)]">
          |
        </span>
        <Link
          href="/legal/privacy"
          className="transition-colors hover:text-[var(--color-ink)] hover:underline"
        >
          Privacy Policy
        </Link>
      </nav>
    </footer>
  );
}
