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
  children: React.ReactNode;
}

export function PortalShell({
  role,
  fullName,
  email,
  children,
}: PortalShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)]">
      <PortalSidebar role={role} fullName={fullName} email={email} />
      <main className="relative flex-1 px-4 pb-6 pt-20 md:px-8 md:pb-8 lg:py-8">
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
              onNavClick={() => setDrawerOpen(false)}
            />
          </SheetContent>
        </Sheet>
        {children}
      </main>
    </div>
  );
}
