"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { RealtimeEvent } from "@/lib/realtime";

/**
 * Headless component: subscribes to audit.entry events and triggers a
 * Server Component refresh so the audit table picks up new rows within ~2s.
 * Renders nothing — mount once per audit page.
 */
export function AuditRealtimeClient() {
  const router = useRouter();

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useRealtimeChannel(RealtimeEvent.AuditEntry, refresh);

  return null;
}
