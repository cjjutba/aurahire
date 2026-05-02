import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-surface-soft)]">
      <header className="flex items-center justify-center px-6 py-8">
        <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">
          AuraHire
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        {children}
      </main>
      <footer className="px-6 py-6 text-center text-xs text-[var(--color-muted)]">
        © {new Date().getFullYear()} AuraHire
      </footer>
    </div>
  );
}
