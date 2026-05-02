import Link from "next/link";

const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/jobs", label: "Browse Jobs" },
] as const;

export function MarketingNav() {
  return (
    <header className="border-b border-[var(--color-hairline-soft)] bg-[var(--color-canvas)]">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-[var(--color-ink)]"
        >
          AuraHire
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[var(--color-body)] transition hover:text-[var(--color-ink)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-[var(--color-body)] transition hover:text-[var(--color-ink)] sm:inline"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)]"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
