"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { CompanyCreateDialog } from "./company-create-dialog";
import { AcceptInvitationDialog } from "./accept-invitation-dialog";
import { toastApiError } from "@/lib/toast";

/**
 * Recruiter sidebar combobox that replaces the static "TechCorp Inc." chip.
 * Lists every active membership; switching invokes the context's
 * `switchCompany` action which handles the localStorage singleton, parallel
 * server PATCH, query invalidation, SSR transition, and detail-page redirects.
 *
 * Switching state is owned by the provider so the global overlay can stay
 * mounted until the SSR transition settles. Hovering a non-active row warms
 * the API's Redis cache for that company's dashboard endpoints (~100ms
 * debounce to avoid thrashing on a fast scroll past).
 *
 * Geometry mirrors the previous static chip (h-8 avatar, gap-2, chevron) so
 * the sidebar is visually unchanged at rest.
 */
export function CompanySwitcher() {
  const ctx = useActiveCompany();
  const [createOpen, setCreateOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefetchFn = ctx?.prefetchCompanyDashboard;

  const schedulePrefetch = useCallback(
    (companyId: string) => {
      if (!prefetchFn) return;
      if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = setTimeout(() => {
        prefetchFn(companyId);
      }, 100);
    },
    [prefetchFn],
  );

  const cancelPrefetch = useCallback(() => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => cancelPrefetch(), [cancelPrefetch]);

  if (!ctx) return null;

  const {
    activeMembership,
    memberships,
    isLoading,
    isSwitching,
    switchCompany,
  } = ctx;

  const triggerInitials = activeMembership
    ? getInitials(activeMembership.companyName)
    : isLoading
      ? ""
      : "+";
  const triggerLabel =
    activeMembership?.companyName ?? (isLoading ? "Loading…" : "Add a company");

  async function handleSelect(companyId: string) {
    if (companyId === activeMembership?.companyId) return;
    if (isSwitching) return;
    try {
      await switchCompany(companyId);
    } catch (err) {
      toastApiError(err, "Failed to switch company");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              disabled={isSwitching}
              aria-label="Switch company"
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
          {isLoading ? (
            <div className="px-2 py-2 text-xs text-[var(--color-muted)]">
              Loading companies…
            </div>
          ) : memberships.length === 0 ? (
            <div className="px-2 py-2 text-xs text-[var(--color-muted)]">
              No companies yet, create one or accept an invitation below.
            </div>
          ) : (
            memberships.map((m) => {
              const isActive = m.companyId === activeMembership?.companyId;
              return (
                <DropdownMenuItem
                  key={m.companyId}
                  onClick={() => void handleSelect(m.companyId)}
                  onMouseEnter={
                    isActive ? undefined : () => schedulePrefetch(m.companyId)
                  }
                  onMouseLeave={isActive ? undefined : cancelPrefetch}
                  onFocus={
                    isActive ? undefined : () => schedulePrefetch(m.companyId)
                  }
                  onBlur={isActive ? undefined : cancelPrefetch}
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
                  <span className="flex-1 truncate text-sm">
                    {m.companyName}
                  </span>
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
            onClick={() => setCreateOpen(true)}
            className="flex cursor-pointer items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Create new company</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setAcceptOpen(true)}
            className="flex cursor-pointer items-center gap-2"
          >
            <Mail className="h-4 w-4" />
            <span>Accept invitation</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CompanyCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <AcceptInvitationDialog open={acceptOpen} onOpenChange={setAcceptOpen} />
    </>
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
