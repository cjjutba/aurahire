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
  Sliders,
} from "lucide-react";
import type { ComponentType } from "react";
import type { UserRole } from "@aurahire/shared";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  candidate: [
    { href: "/candidate", label: "Dashboard", icon: LayoutDashboard },
    { href: "/candidate/jobs", label: "Browse Jobs", icon: Briefcase },
    { href: "/candidate/applications", label: "Applications", icon: FileText },
    { href: "/candidate/interviews", label: "Interviews", icon: Calendar },
    { href: "/candidate/profile", label: "Profile", icon: User },
    { href: "/candidate/resume", label: "Resume", icon: FileText },
    { href: "/candidate/settings", label: "Settings", icon: Settings },
  ],
  recruiter: [
    { href: "/recruiter", label: "Dashboard", icon: LayoutDashboard },
    { href: "/recruiter/jobs", label: "Jobs", icon: Briefcase },
    { href: "/recruiter/shortlist", label: "Shortlist", icon: Star },
    { href: "/recruiter/interviews", label: "Interviews", icon: Calendar },
    { href: "/recruiter/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/recruiter/settings", label: "Settings", icon: Settings },
  ],
  admin: [
    { href: "/admin", label: "Command Center", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/jobs", label: "Job Moderation", icon: Building2 },
    { href: "/admin/applications", label: "Applications", icon: FileText },
    { href: "/admin/ai-config", label: "AI Config", icon: Sliders },
    { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/admin/bias-monitor", label: "Bias Monitor", icon: ShieldAlert },
  ],
};

const ROLE_LABELS: Record<UserRole, string> = {
  candidate: "Candidate",
  recruiter: "Recruiter",
  admin: "Admin",
};

interface PortalSidebarProps {
  role: UserRole;
}

export function PortalSidebar({ role }: PortalSidebarProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS[role];

  return (
    <aside className="hidden w-64 shrink-0 border-r border-[var(--color-hairline)] bg-[var(--color-surface-soft)] lg:flex lg:flex-col">
      <div className="px-6 py-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-[var(--color-ink)]"
        >
          AuraHire
        </Link>
        <span className="mt-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {ROLE_LABELS[role]}
        </span>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm transition",
                isActive
                  ? "bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]"
                  : "text-[var(--color-body)] hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]",
              ].join(" ")}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
