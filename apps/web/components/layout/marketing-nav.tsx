"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { BrandWordmark } from "@/components/brand/brand-wordmark";

const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/jobs", label: "Browse Jobs" },
] as const;

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-[var(--color-hairline-soft)] bg-[var(--color-canvas)]">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="AuraHire home">
          <BrandWordmark size="md" priority />
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
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-[var(--color-body)] transition hover:text-[var(--color-ink)] sm:inline"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)] sm:px-5"
          >
            Get Started
          </Link>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className="rounded-[var(--radius-md)] p-2 text-[var(--color-ink)] md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-72 bg-[var(--color-canvas)] p-6"
            >
              <nav className="flex flex-col gap-1 pt-10">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-[var(--radius-md)] px-3 py-3 text-base font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-[var(--radius-md)] px-3 py-3 text-base font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)] sm:hidden"
                >
                  Sign In
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
