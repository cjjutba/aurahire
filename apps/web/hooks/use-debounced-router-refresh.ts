"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Returns a stable trigger function. Repeated calls within `waitMs` collapse
 * into a single trailing-edge `router.refresh()`, useful when a stream of
 * server-pushed events would otherwise cause a refresh storm on the audit
 * feed or bias monitor (a bulk admin action emits N audit rows in quick
 * succession; we want one Server Component re-render, not N).
 *
 * Trailing-edge so the most recent state is always reflected; the timer is
 * reset on each call so a sustained burst is captured by a single refresh
 * after the burst quiets.
 */
export function useDebouncedRouterRefresh(waitMs = 1500): () => void {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      router.refresh();
    }, waitMs);
  }, [router, waitMs]);
}
