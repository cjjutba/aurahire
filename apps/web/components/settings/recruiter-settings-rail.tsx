"use client";

import {
  Bell,
  Building2,
  Lock,
  MapPin,
  Plug,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Trash2,
  User,
  Users,
} from "lucide-react";

import { useActiveCompany } from "@/contexts/active-company-context";

import { SettingsRail, type SettingsRailGroup } from "./settings-rail";

/**
 * Builds the rail for /recruiter/settings/*. Personal group is always
 * shown; the company group is gated on the active membership's role.
 *
 * Visibility rules (per the Phase 5 spec):
 *   - Profile / Security / Notifications / Privacy — always visible
 *   - Danger Zone — always visible (recruiters get only "Leave company"
 *                   inside; the page itself enforces the subsection rules)
 *   - Company / Team Members / Scoring / Bias / Integrations — only for
 *                   owner + admin
 *
 * The company group's heading mirrors the active company name so the rail
 * doubles as a visual confirmation of which workspace the user is editing.
 * If the user has no active company yet (transient state during a switch),
 * we hide the company group entirely rather than show a placeholder.
 */
export function RecruiterSettingsRail() {
  const ctx = useActiveCompany();
  const role = ctx?.activeMembership?.role ?? null;
  const companyName = ctx?.activeMembership?.companyName ?? null;
  const isOwnerOrAdmin = role === "owner" || role === "admin";

  const groups: SettingsRailGroup[] = [
    {
      label: "Personal",
      items: [
        { href: "/recruiter/settings/profile", label: "Profile", icon: User },
        {
          href: "/recruiter/settings/security",
          label: "Security",
          icon: Lock,
        },
        {
          href: "/recruiter/settings/notifications",
          label: "Notifications",
          icon: Bell,
        },
        {
          href: "/recruiter/settings/privacy",
          label: "Privacy",
          icon: ShieldCheck,
        },
      ],
    },
  ];

  if (companyName) {
    const companyItems: SettingsRailGroup["items"] = [];
    if (isOwnerOrAdmin) {
      companyItems.push(
        {
          href: "/recruiter/settings/company",
          label: "Company",
          icon: Building2,
        },
        {
          href: "/recruiter/settings/members",
          label: "Team Members",
          icon: Users,
        },
        {
          href: "/recruiter/settings/scoring",
          label: "Scoring",
          icon: Sliders,
        },
        {
          href: "/recruiter/settings/bias",
          label: "Bias & Fairness",
          icon: Scale,
        },
        {
          href: "/recruiter/settings/integrations",
          label: "Integrations",
          icon: Plug,
        },
        {
          href: "/recruiter/settings/interview-venues",
          label: "Interview Venues",
          icon: MapPin,
        },
      );
    }
    // Danger Zone is visible to every active member — recruiter-role
    // members see the page but only "Leave company" within it.
    companyItems.push({
      href: "/recruiter/settings/danger",
      label: "Danger Zone",
      icon: ShieldAlert,
    });
    groups.push({
      label: companyName,
      items: companyItems,
    });
  }

  // The recruiter-only fallback: if the active membership is "recruiter"
  // (no company management), still expose Danger Zone (Leave company) at
  // the personal level so the user has an exit path even when they don't
  // see the Company group's other items.
  if (!isOwnerOrAdmin && companyName) {
    // already added under the company group above — nothing extra here.
  }
  if (!companyName && groups[0]) {
    // No active company at all — surface a Danger Zone item that the page
    // will gracefully no-op against.
    groups[0].items.push({
      href: "/recruiter/settings/danger",
      label: "Danger Zone",
      icon: Trash2,
    });
  }

  return <SettingsRail groups={groups} />;
}
