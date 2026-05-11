"use client";

import { Bell, Lock, ShieldCheck, User } from "lucide-react";

import { SettingsRail, type SettingsRailGroup } from "./settings-rail";

/**
 * Candidate-side rail. Candidates have no multi-tenancy, only the
 * Personal group ships. The same SettingsRail primitive is reused so the
 * geometry matches the recruiter's rail to the pixel.
 */
export function CandidateSettingsRail() {
  const groups: SettingsRailGroup[] = [
    {
      label: "Personal",
      items: [
        { href: "/candidate/settings/profile", label: "Profile", icon: User },
        {
          href: "/candidate/settings/security",
          label: "Security",
          icon: Lock,
        },
        {
          href: "/candidate/settings/notifications",
          label: "Notifications",
          icon: Bell,
        },
        {
          href: "/candidate/settings/privacy",
          label: "Privacy",
          icon: ShieldCheck,
        },
      ],
    },
  ];

  return <SettingsRail groups={groups} />;
}
