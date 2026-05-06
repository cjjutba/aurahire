"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import {
  useMembershipsQuery,
  setActiveCompanyOnServer,
  type Membership,
} from "@/hooks/use-membership";
import {
  getActiveCompanyId,
  setActiveCompanyId,
} from "@/lib/active-company";

interface ActiveCompanyContextValue {
  activeCompanyId: string | null;
  activeMembership: Membership | null;
  memberships: Membership[];
  isLoading: boolean;
  switchCompany: (companyId: string) => Promise<void>;
}

const ActiveCompanyContext = createContext<ActiveCompanyContextValue | null>(
  null,
);

/**
 * Holds the user's memberships + currently active company id and exposes
 * `switchCompany()` for the sidebar combobox.
 *
 * Initial value flow:
 *   1. Server component fetches profile → reads `lastActiveCompanyId`.
 *   2. Provider seeds the localStorage singleton with that value the first
 *      time it mounts (only when localStorage was previously empty — we
 *      don't override a user's most recent client-side switch on a hard
 *      refresh).
 *   3. After mount, the singleton is the source of truth on the client.
 *
 * Switch flow:
 *   1. Update the local singleton synchronously so subsequent fetches
 *      already carry the new X-Active-Company-Id header.
 *   2. PATCH /profiles/me { lastActiveCompanyId } so server-rendered pages
 *      (which don't see the header) and the ActiveCompanyGuard fallback
 *      see the new value before we trigger a refresh.
 *   3. Clear TanStack Query so cached previous-company data is dropped.
 *   4. If we're on a detail page (e.g. /recruiter/jobs/abc-123), redirect
 *      to the section index — the resource probably belongs to the previous
 *      company and would 404 against the new one.
 *   5. router.refresh() — server components re-render with the new tenant.
 */
export function ActiveCompanyProvider({
  children,
  initialActiveCompanyId,
}: {
  children: React.ReactNode;
  initialActiveCompanyId: string | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const seeded = useRef(false);

  // Seed the singleton from the server-rendered initial value exactly once.
  // After this point, the singleton is the source of truth.
  if (!seeded.current && typeof window !== "undefined") {
    seeded.current = true;
    const existing = getActiveCompanyId();
    if (!existing && initialActiveCompanyId) {
      setActiveCompanyId(initialActiveCompanyId);
    }
  }

  // Memberships query is gated on the resolver being installed — without a
  // company id the API call would 403. We rely on the AuthTokenProvider
  // running before us in the layout tree.
  const { data, isLoading } = useMembershipsQuery();
  const memberships = useMemo(() => data?.data ?? [], [data?.data]);

  // The active company id, in priority order:
  //   1. localStorage singleton (most recent client-side switch)
  //   2. server-rendered initial value
  //   3. first membership (auto-select on a fresh login with no pointer set)
  const activeCompanyId =
    (typeof window !== "undefined" ? getActiveCompanyId() : null) ??
    initialActiveCompanyId ??
    memberships[0]?.companyId ??
    null;

  // If we just auto-selected from the memberships list (case 3 above),
  // mirror the choice into the singleton so the next fetch carries the header.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (getActiveCompanyId()) return;
    if (!memberships[0]) return;
    setActiveCompanyId(memberships[0].companyId);
  }, [memberships]);

  const activeMembership =
    memberships.find((m) => m.companyId === activeCompanyId) ?? null;

  const switchCompany = useCallback(
    async (companyId: string) => {
      // 1. Update client singleton first so subsequent fetches use new header.
      setActiveCompanyId(companyId);

      // 2. Persist on the server so server-rendered pages + guard fallback
      //    see the new value before we refresh.
      try {
        await setActiveCompanyOnServer(companyId);
      } catch (err) {
        // If the server rejects the switch, roll the client state back so the
        // UI doesn't appear desynced from reality.
        setActiveCompanyId(initialActiveCompanyId ?? null);
        throw err;
      }

      // 3. Drop all cached query data — the previous company's data is now
      //    stale by definition.
      queryClient.clear();

      // 4. If we're on a detail page, jump to the section index. Resources
      //    keyed by id (jobs/{id}, applications/{id}, etc.) will almost
      //    certainly 404 against the new tenant.
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        const detailPathMatch = path.match(/^(\/recruiter\/[^/]+)\/[^/]+/);
        if (detailPathMatch?.[1]) {
          router.push(detailPathMatch[1]);
        }
      }

      // 5. Re-render server components with the new tenant context.
      router.refresh();
    },
    [initialActiveCompanyId, queryClient, router],
  );

  const value = useMemo<ActiveCompanyContextValue>(
    () => ({
      activeCompanyId,
      activeMembership,
      memberships,
      isLoading,
      switchCompany,
    }),
    [activeCompanyId, activeMembership, memberships, isLoading, switchCompany],
  );

  return (
    <ActiveCompanyContext.Provider value={value}>
      {children}
    </ActiveCompanyContext.Provider>
  );
}

/**
 * Returns the active-company context, or null when called from a tree that
 * isn't wrapped by the provider (candidate-side, public, admin pages).
 * Callers should branch on null to avoid throwing during render.
 */
export function useActiveCompany(): ActiveCompanyContextValue | null {
  return useContext(ActiveCompanyContext);
}
