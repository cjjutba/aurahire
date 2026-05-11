"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@aurahire/shared";

import {
  useMembershipsQuery,
  setActiveCompanyOnServer,
  type Membership,
} from "@/hooks/use-membership";
import { getActiveCompanyId, setActiveCompanyId } from "@/lib/active-company";
import { prefetchDashboardForCompany } from "@/lib/dashboard-prefetch";

/**
 * AuthTokenProvider populates the module-level access token from a useEffect,
 * so the very first render of any consumer sees `null`. Without this gate the
 * memberships fetch races past the token write and 401s on cold loads.
 */
function useAuthTokenReady(): boolean {
  const [ready, setReady] = useState(() =>
    typeof window !== "undefined" ? getAccessToken() !== null : false,
  );
  useEffect(() => {
    if (ready) return;
    const interval = window.setInterval(() => {
      if (getAccessToken() !== null) {
        setReady(true);
        window.clearInterval(interval);
      }
    }, 50);
    return () => window.clearInterval(interval);
  }, [ready]);
  return ready;
}

export interface ActiveCompanyContextValue {
  activeCompanyId: string | null;
  activeMembership: Membership | null;
  memberships: Membership[];
  isLoading: boolean;
  /** True from the moment switchCompany is called until the SSR transition settles. */
  isSwitching: boolean;
  /** Display name of the company being switched TO. Null when not switching. */
  pendingCompanyName: string | null;
  switchCompany: (companyId: string) => Promise<void>;
  /** Fire warming GETs to the recruiter dashboard endpoints for `companyId`. */
  prefetchCompanyDashboard: (companyId: string) => void;
}

const ActiveCompanyContext = createContext<ActiveCompanyContextValue | null>(
  null,
);

/**
 * Test-only export. Production consumers must use `useActiveCompany()`.
 * The overlay's test harness needs a way to inject context values without
 * spinning up the full provider's auth/membership fetch.
 */
export const ActiveCompanyContextForTesting = ActiveCompanyContext;

/**
 * Holds the user's memberships + currently active company id and exposes
 * `switchCompany()` for the sidebar combobox.
 *
 * Initial value flow:
 *   1. Server component fetches profile → reads `lastActiveCompanyId`.
 *   2. Provider seeds the localStorage singleton with that value the first
 *      time it mounts (only when localStorage was previously empty, we
 *      don't override a user's most recent client-side switch on a hard
 *      refresh).
 *   3. After mount, the singleton is the source of truth on the client.
 *
 * Switch flow:
 *   1. Update the local singleton synchronously so subsequent fetches
 *      already carry the new X-Active-Company-Id header.
 *   2. Kick off PATCH /profiles/me { lastActiveCompanyId } in parallel
 *      with the SSR transition, the PATCH only matters for SSR pages
 *      and the guard's profile-lookup fallback; client requests already
 *      use the localStorage singleton via the header.
 *   3. Clear TanStack Query so cached previous-company data is dropped.
 *   4. Inside React's useTransition, branch on pathname:
 *      - Detail page (`/recruiter/<section>/<id>`): router.push to the
 *        section index. The push triggers a fresh SSR pass; we skip the
 *        explicit refresh because that would duplicate the render.
 *      - Otherwise: router.refresh().
 *   5. The transition's isPending stays true until the new tree renders;
 *      the overlay reads isSwitching (driven by isPending) to know when
 *      to unmount.
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

  // Memberships query is gated on the access token being set, without it the
  // request races past AuthTokenProvider's useEffect and 401s on cold loads.
  const tokenReady = useAuthTokenReady();
  const { data, isLoading } = useMembershipsQuery(tokenReady);
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

  // ── Switch lifecycle: isSwitching gates the global overlay; pendingCompanyName
  // labels it. isPending (from useTransition) tracks the SSR-render commit so
  // we know when to lower the overlay.
  const [isSwitching, setIsSwitching] = useState(false);
  const [pendingCompanyName, setPendingCompanyName] = useState<string | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  // When the SSR transition settles, take the overlay down. Only acts while
  // a switch is in progress so unrelated transitions elsewhere in the tree
  // don't accidentally toggle this state.
  useEffect(() => {
    if (!isPending && isSwitching) {
      setIsSwitching(false);
      setPendingCompanyName(null);
    }
  }, [isPending, isSwitching]);

  const switchCompany = useCallback(
    async (companyId: string) => {
      if (companyId === activeCompanyId) return;

      const target = memberships.find((m) => m.companyId === companyId);
      setPendingCompanyName(target?.companyName ?? null);
      setIsSwitching(true);

      // 1. Synchronous singleton update, next outgoing fetch carries the new header.
      const previousCompanyId = activeCompanyId;
      setActiveCompanyId(companyId);

      // 2. Start PATCH (don't await yet, let it race the SSR transition).
      const patchPromise = setActiveCompanyOnServer(companyId).catch((err) => {
        // Rollback path: restore client singleton, clear UI state, re-throw so
        // CompanySwitcher.handleSelect surfaces the toast.
        setActiveCompanyId(previousCompanyId ?? initialActiveCompanyId ?? null);
        setIsSwitching(false);
        setPendingCompanyName(null);
        throw err;
      });

      // 3. Drop cached previous-tenant client data.
      queryClient.clear();

      // 4. Trigger SSR transition. On a detail page we push to the section
      //    index (push triggers SSR; refresh would duplicate). Otherwise refresh.
      startTransition(() => {
        if (typeof window !== "undefined") {
          const path = window.location.pathname;
          const detailMatch = path.match(/^(\/recruiter\/[^/]+)\/[^/]+/);
          if (detailMatch?.[1]) {
            router.push(detailMatch[1]);
            return;
          }
        }
        router.refresh();
      });

      // 5. Await PATCH for error surfacing. The transition runs in parallel.
      await patchPromise;
    },
    [activeCompanyId, memberships, initialActiveCompanyId, queryClient, router],
  );

  const prefetchCompanyDashboard = useCallback((companyId: string) => {
    prefetchDashboardForCompany(companyId);
  }, []);

  const value = useMemo<ActiveCompanyContextValue>(
    () => ({
      activeCompanyId,
      activeMembership,
      memberships,
      isLoading,
      isSwitching,
      pendingCompanyName,
      switchCompany,
      prefetchCompanyDashboard,
    }),
    [
      activeCompanyId,
      activeMembership,
      memberships,
      isLoading,
      isSwitching,
      pendingCompanyName,
      switchCompany,
      prefetchCompanyDashboard,
    ],
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
