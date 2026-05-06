"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, Mail, Check } from "lucide-react";

import { useActiveCompany } from "@/contexts/active-company-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toastApiError } from "@/lib/toast";

/**
 * Recruiter sidebar combobox that replaces the static "TechCorp Inc." chip.
 * Lists every active membership; switching invokes the context's
 * `switchCompany` action which handles fetch headers, server PATCH, query
 * invalidation, and detail-page redirects.
 *
 * Geometry mirrors the previous static chip (h-8 avatar, gap-2, chevron) so
 * the sidebar visually unchanged at rest.
 */
export function CompanySwitcher() {
  const ctx = useActiveCompany();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  if (!ctx) return null;

  const { activeMembership, memberships, switchCompany } = ctx;

  const triggerInitials = activeMembership
    ? getInitials(activeMembership.companyName)
    : "?";
  const triggerLabel = activeMembership?.companyName ?? "Workspace";

  async function handleSelect(companyId: string) {
    if (companyId === activeMembership?.companyId) return;
    if (switching) return;
    setSwitching(true);
    try {
      await switchCompany(companyId);
    } catch (err) {
      toastApiError(err, "Failed to switch company");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={switching}
            aria-label="Switch workspace"
            className="mt-4 flex w-full items-center gap-2 rounded-[var(--radius-md)] py-1 text-left transition hover:bg-[var(--color-surface-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-60"
          />
        }
      >
        <Avatar className="h-8 w-8">
          {activeMembership?.companyLogoUrl ? (
            <AvatarImage src={activeMembership.companyLogoUrl} alt="" />
          ) : null}
          <AvatarFallback className="bg-[var(--color-surface-strong)] text-xs font-semibold text-[var(--color-ink)]">
            {triggerInitials}
          </AvatarFallback>
        </Avatar>
        <span className="flex-1 truncate text-sm font-medium text-[var(--color-ink)]">
          {triggerLabel}
        </span>
        <ChevronsUpDown
          className="h-4 w-4 text-[var(--color-muted)]"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="w-64">
        {memberships.length === 0 ? (
          <div className="px-2 py-2 text-xs text-[var(--color-muted)]">
            No workspaces yet
          </div>
        ) : (
          memberships.map((m) => {
            const isActive = m.companyId === activeMembership?.companyId;
            return (
              <DropdownMenuItem
                key={m.companyId}
                onClick={() => void handleSelect(m.companyId)}
                className="flex cursor-pointer items-center gap-2"
              >
                <Avatar className="h-6 w-6">
                  {m.companyLogoUrl ? (
                    <AvatarImage src={m.companyLogoUrl} alt="" />
                  ) : null}
                  <AvatarFallback className="bg-[var(--color-surface-strong)] text-[10px] font-semibold text-[var(--color-ink)]">
                    {getInitials(m.companyName)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-sm">{m.companyName}</span>
                <span className="text-[11px] capitalize text-[var(--color-muted)]">
                  {m.role}
                </span>
                {isActive ? (
                  <Check
                    className="h-4 w-4 text-[var(--color-primary)]"
                    aria-hidden
                  />
                ) : null}
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push("/onboarding/company?from=switcher")}
          className="flex cursor-pointer items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          <span>Create new company</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push("/invite")}
          className="flex cursor-pointer items-center gap-2"
        >
          <Mail className="h-4 w-4" />
          <span>Accept invitation</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
