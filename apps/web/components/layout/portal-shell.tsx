"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import type { UserRole } from "@aurahire/shared";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { PortalSidebar, PortalSidebarContent } from "./portal-sidebar";

interface PortalShellProps {
  role: UserRole;
  fullName: string;
  email: string;
  companyName: string | null;
  children: React.ReactNode;
}

export function PortalShell({
  role,
  fullName,
  email,
  companyName,
  children,
}: PortalShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)]">
      <PortalSidebar role={role} fullName={fullName} email={email} companyName={companyName} />
      <main className="relative flex-1 px-4 py-6 md:px-8 md:py-8">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger
            className="absolute left-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-ink)] hover:bg-[var(--color-surface-strong)] lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-[var(--color-canvas)] p-0">
            <PortalSidebarContent
              role={role}
              fullName={fullName}
              email={email}
              companyName={companyName}
              onNavClick={() => setDrawerOpen(false)}
            />
          </SheetContent>
        </Sheet>
        {children}
      </main>
    </div>
  );
}
