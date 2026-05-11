"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  MessageSquare,
} from "lucide-react";
import type { ComponentType } from "react";
import type { UserRole } from "@aurahire/shared";
import { BrandWordmark } from "@/components/brand/brand-wordmark";
import { CompanySwitcher } from "@/components/layout/company-switcher";
import { SidebarBottomRail } from "@/components/portal/sidebar-bottom-rail";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  // Path prefix for active-state matching when it differs from `href`. Lets
  // Settings link straight to `/settings/profile` while still highlighting
  // on every `/settings/*` sub-page.
  matchPrefix?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

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
        {
          href: "/candidate/applications",
          label: "Applications",
          icon: FileText,
        },
        { href: "/candidate/interviews", label: "Interviews", icon: Calendar },
      ],
    },
    {
      label: "Account",
      items: [
        { href: "/candidate/profile", label: "Profile", icon: User },
        { href: "/candidate/resume", label: "Resume", icon: FileText },
        {
          href: "/candidate/settings/profile",
          label: "Settings",
          icon: Settings,
          matchPrefix: "/candidate/settings",
        },
      ],
    },
  ],
  recruiter: [
    {
      label: "Main",
      items: [
        { href: "/recruiter", label: "Dashboard", icon: LayoutDashboard },
      ],
    },
    {
      label: "Pipeline",
      items: [
        { href: "/recruiter/jobs", label: "Jobs", icon: Briefcase },
        {
          href: "/recruiter/applications",
          label: "Applications",
          icon: FileText,
        },
        { href: "/recruiter/shortlist", label: "Shortlist", icon: Star },
        { href: "/recruiter/interviews", label: "Interviews", icon: Calendar },
      ],
    },
    {
      label: "Account",
      items: [
        { href: "/recruiter/analytics", label: "Analytics", icon: BarChart3 },
        {
          href: "/recruiter/settings/profile",
          label: "Settings",
          icon: Settings,
          matchPrefix: "/recruiter/settings",
        },
      ],
    },
  ],
  admin: [
    {
      label: "Main",
      items: [
        { href: "/admin", label: "Command Center", icon: LayoutDashboard },
      ],
    },
    {
      label: "Operations",
      items: [
        { href: "/admin/users", label: "Users", icon: Users },
        { href: "/admin/companies", label: "Companies", icon: Building2 },
        { href: "/admin/jobs", label: "Job Moderation", icon: Briefcase },
        { href: "/admin/applications", label: "Applications", icon: FileText },
      ],
    },
    {
      label: "Insights",
      items: [
        {
          href: "/admin/ai-config",
          label: "AI Config",
          icon: SlidersHorizontal,
        },
        { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
        { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
        {
          href: "/admin/bias-monitor",
          label: "Bias Monitor",
          icon: ShieldAlert,
        },
        { href: "/admin/feedback", label: "Feedback", icon: MessageSquare },
      ],
    },
  ],
};

interface PortalSidebarProps {
  role: UserRole;
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

export function PortalSidebar({
  role,
  userId,
  fullName,
  email,
  avatarUrl,
}: PortalSidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 bg-[var(--color-canvas)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:self-start">
      <PortalSidebarContent
        role={role}
        userId={userId}
        fullName={fullName}
        email={email}
        avatarUrl={avatarUrl}
      />
    </aside>
  );
}

interface PortalSidebarContentProps {
  role: UserRole;
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  onNavClick?: () => void;
}

export function PortalSidebarContent({
  role,
  userId,
  fullName,
  email,
  avatarUrl,
  onNavClick,
}: PortalSidebarContentProps) {
  const pathname = usePathname();
  const sections = NAV_SECTIONS[role];
  const activeHref = resolveActiveHref(
    pathname,
    sections.flatMap((s) =>
      s.items.map((i) => ({ href: i.href, prefix: i.matchPrefix ?? i.href })),
    ),
  );

  return (
    <div className="flex h-full flex-col">
      {/* Top: brand wordmark + tenant chip */}
      <div className="px-6 pt-6 pb-4">
        <Link href="/" onClick={onNavClick} aria-label="AuraHire home">
          <BrandWordmark size="md" />
        </Link>
        {role === "recruiter" ? <CompanySwitcher /> : null}
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

      {/* Bottom rail: avatar + name + three-dot + bell. Replaces the legacy
       * Help link + sign-out dropdown, Help, Settings, theme, and sign-out
       * now live inside the profile popover surfaced by the rail. */}
      <SidebarBottomRail
        user={{
          id: userId,
          name: fullName,
          email,
          avatarUrl,
          role,
        }}
      />
    </div>
  );
}

function resolveActiveHref(
  pathname: string,
  items: { href: string; prefix: string }[],
): string | null {
  let best: { href: string; prefix: string } | null = null;
  for (const item of items) {
    const matches =
      pathname === item.prefix || pathname.startsWith(`${item.prefix}/`);
    if (!matches) continue;
    if (best === null || item.prefix.length > best.prefix.length) {
      best = item;
    }
  }
  return best?.href ?? null;
}
