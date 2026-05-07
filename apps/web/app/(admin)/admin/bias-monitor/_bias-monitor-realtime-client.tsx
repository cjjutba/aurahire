"use client";

import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { useDebouncedRouterRefresh } from "@/hooks/use-debounced-router-refresh";
import { RealtimeEvent } from "@/lib/realtime";

/**
 * Headless component: subscribes to bias.flag_created events and triggers a
 * debounced Server Component refresh. A scanJob that produces N flag rows
 * back-to-back collapses into a single bias-monitor re-render.
 */
export function BiasMonitorRealtimeClient() {
  const refresh = useDebouncedRouterRefresh();
  useRealtimeChannel(RealtimeEvent.BiasFlagCreated, refresh);
  return null;
}
