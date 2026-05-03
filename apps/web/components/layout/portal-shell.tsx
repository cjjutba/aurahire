import type { UserRole } from "@aurahire/shared";
import { PortalSidebar } from "./portal-sidebar";
import { PortalTopbar } from "./portal-topbar";
import { PortalFooter } from "./portal-footer";

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
  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)]">
      <PortalSidebar role={role} />
      <div className="flex min-h-screen flex-1 flex-col">
        <PortalTopbar fullName={fullName} email={email} role={role} />
        <main className="flex-1 bg-[var(--color-surface-soft)] px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
        <PortalFooter />
      </div>
    </div>
  );
}
