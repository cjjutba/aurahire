"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { RealtimeEvent } from "@/lib/realtime";

/**
 * Headless component: subscribes to bias.flag_created events and triggers a
 * Server Component refresh so bias flag counts and breakdowns update within ~2s.
 * Renders nothing — mount once per bias-monitor page.
 */
export function BiasMonitorRealtimeClient() {
  const router = useRouter();

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useRealtimeChannel(RealtimeEvent.BiasFlagCreated, refresh);

  return null;
}
