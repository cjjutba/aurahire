"use client";

import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { useDebouncedRouterRefresh } from "@/hooks/use-debounced-router-refresh";
import { RealtimeEvent } from "@/lib/realtime";

/**
 * Headless component: subscribes to audit.entry events and triggers a
 * debounced Server Component refresh so the audit table picks up new rows
 * within ~2s — but a bulk admin action that emits N rows back-to-back
 * collapses into a single refresh.
 */
export function AuditRealtimeClient() {
  const refresh = useDebouncedRouterRefresh();
  useRealtimeChannel(RealtimeEvent.AuditEntry, refresh);
  return null;
}
