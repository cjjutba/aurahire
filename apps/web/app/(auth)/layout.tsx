import Link from "next/link";

import { AuthFooter } from "@/components/auth/auth-footer";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)]">
      <header className="border-b border-[var(--color-hairline-soft)] px-6 py-5 sm:px-8 sm:py-6">
        <Link
          href="/"
          className="text-[18px] font-semibold tracking-tight text-[var(--color-ink)]"
        >
          AuraHire
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-20">
        {children}
      </main>
      <AuthFooter />
    </div>
  );
}
