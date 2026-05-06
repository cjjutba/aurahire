"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Calendar,
  User,
  Settings,
  Users,
  Star,
  BarChart3,
  Building2,
  ShieldAlert,
  ScrollText,
  SlidersHorizontal,
  BookOpen,
  ChevronsUpDown,
  LogOut,
} from "lucide-react";
import type { ComponentType } from "react";
import type { UserRole } from "@aurahire/shared";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { setSessionOnlyMarker } from "@/lib/auth/cookie-persistence.client";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandWordmark } from "@/components/brand/brand-wordmark";
import { CompanySwitcher } from "@/components/layout/company-switcher";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const HELP_HREF: Record<UserRole, string> = {
  candidate: "/candidate/help",
  recruiter: "/recruiter/help",
  admin: "/admin/help",
};

const NAV_SECTIONS: Record<UserRole, NavSection[]> = {
  candidate: [
    {
      label: "Main",
      items: [
        { href: "/candidate", label: "Dashboard", icon: LayoutDashboard },
        { href: "/candidate/jobs", label: "Browse Jobs", icon: Briefcase },
      ],
    },
    {
      label: "Pipeline",
      items: [
        { href: "/candidate/applications", label: "Applications", icon: FileText },
        { href: "/candidate/interviews", label: "Interviews", icon: Calendar },
      ],
    },
    {
      label: "Account",
      items: [
        { href: "/candidate/profile", label: "Profile", icon: User },
        { href: "/candidate/resume", label: "Resume", icon: FileText },
        { href: "/candidate/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
  recruiter: [
    {
      label: "Main",
      items: [{ href: "/recruiter", label: "Dashboard", icon: LayoutDashboard }],
    },
    {
      label: "Pipeline",
      items: [
        { href: "/recruiter/jobs", label: "Jobs", icon: Briefcase },
        { href: "/recruiter/shortlist", label: "Shortlist", icon: Star },
        { href: "/recruiter/interviews", label: "Interviews", icon: Calendar },
      ],
    },
    {
      label: "Account",
      items: [
        { href: "/recruiter/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/recruiter/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
  admin: [
    {
      label: "Main",
      items: [{ href: "/admin", label: "Command Center", icon: LayoutDashboard }],
    },
    {
      label: "Operations",
      items: [
        { href: "/admin/users", label: "Users", icon: Users },
        { href: "/admin/jobs", label: "Job Moderation", icon: Building2 },
        { href: "/admin/applications", label: "Applications", icon: FileText },
      ],
    },
    {
      label: "Insights",
      items: [
        { href: "/admin/ai-config", label: "AI Config", icon: SlidersHorizontal },
        { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
        { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/admin/bias-monitor", label: "Bias Monitor", icon: ShieldAlert },
      ],
    },
  ],
};

interface PortalSidebarProps {
  role: UserRole;
  fullName: string;
  email: string;
  companyName: string | null;
}

export function PortalSidebar({ role, fullName, email, companyName }: PortalSidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 bg-[var(--color-canvas)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:self-start">
      <PortalSidebarContent
        role={role}
        fullName={fullName}
        email={email}
        companyName={companyName}
      />
    </aside>
  );
}

interface PortalSidebarContentProps {
  role: UserRole;
  fullName: string;
  email: string;
  companyName: string | null;
  onNavClick?: () => void;
}

export function PortalSidebarContent({
  role,
  fullName,
  email,
  companyName,
  onNavClick,
}: PortalSidebarContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const sections = NAV_SECTIONS[role];
  const initials = getInitials(fullName);
  const tenantInitials = companyName ? getInitials(companyName) : "AH";
  const activeHref = resolveActiveHref(pathname, [
    ...sections.flatMap((s) => s.items.map((i) => i.href)),
    HELP_HREF[role],
  ]);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toastApiError(error, "Sign out failed");
      return;
    }
    setSessionOnlyMarker(false);
    toastSuccess("Signed out");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top: brand wordmark + tenant chip */}
      <div className="px-6 pt-6 pb-4">
        <Link
          href="/"
          onClick={onNavClick}
          aria-label="AuraHire home"
        >
          <BrandWordmark size="md" />
        </Link>
        {role === "recruiter" ? (
          // Recruiters have multi-tenancy: switcher reads memberships +
          // active company from ActiveCompanyContext.
          <CompanySwitcher />
        ) : (
          // Candidate + admin portals don't have multi-company semantics.
          // Keep a static chip for visual continuity (it's display-only).
          <div
            className="mt-4 flex w-full items-center gap-2"
            aria-label="Workspace"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-[var(--color-surface-strong)] text-xs font-semibold text-[var(--color-ink)]">
                {tenantInitials}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate text-sm font-medium text-[var(--color-ink)]">
              {companyName ?? "Workspace"}
            </span>
          </div>
        )}
      </div>

      {/* Sections */}
      <nav className="flex-1 space-y-6 px-3">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              {section.label}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = activeHref === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavClick}
                    className={[
                      "flex h-9 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm transition",
                      isActive
                        ? "bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]"
                        : "text-[var(--color-body)] hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]",
                    ].join(" ")}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom block: Help + user chip */}
      <div className="border-t border-[var(--color-hairline-soft)] p-3">
        <Link
          href={HELP_HREF[role]}
          onClick={onNavClick}
          className={[
            "flex h-9 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm transition",
            activeHref === HELP_HREF[role]
              ? "bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]"
              : "text-[var(--color-body)] hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]",
          ].join(" ")}
        >
          <BookOpen className="h-[18px] w-[18px]" />
          <span className="flex-1">Help &amp; Docs</span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="mt-1 flex h-12 w-full items-center gap-2 rounded-[var(--radius-md)] px-3 text-left transition hover:bg-[var(--color-surface-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              />
            }
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-[var(--color-surface-strong)] text-xs font-semibold text-[var(--color-ink)]">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate text-sm font-medium text-[var(--color-ink)]">
              {fullName}
            </span>
            <ChevronsUpDown className="h-4 w-4 text-[var(--color-muted)]" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="font-semibold text-[var(--color-ink)]">{fullName}</div>
                <div className="text-xs font-normal text-[var(--color-muted)]">{email}</div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function resolveActiveHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (!matches) continue;
    if (best === null || href.length > best.length) {
      best = href;
    }
  }
  return best;
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
