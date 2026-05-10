"use client";

import { useEffect } from "react";

import { useSocket } from "@/components/providers/socket-provider";
import type {
  RealtimeEventName,
  RealtimeEventPayloadMap,
} from "@/lib/realtime";

/**
 * Subscribe a typed handler to a single realtime event for the lifetime of
 * the calling component. The handler is wrapped in a try/catch so a buggy
 * caller cannot kill the socket.
 *
 * **Handler stability:** the `handler` argument is intentionally NOT in the
 * effect deps. If your handler closes over reactive state (anything that
 * changes between renders), wrap it in `useCallback` with the right deps —
 * otherwise stale closures will read stale state. Most call sites in this
 * codebase only close over stable identifiers (`applicationId`, `jobId` from
 * route params; `queryClient` from a stable hook) and don't need this.
 */
export function useRealtimeChannel<E extends RealtimeEventName>(
  event: E,
  handler: (payload: RealtimeEventPayloadMap[E]) => void,
): void {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;
    const wrapped = (payload: RealtimeEventPayloadMap[E]): void => {
      try {
        handler(payload);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[realtime] handler error for ${event}`, err);
      }
    };
    // socket.io-client's DefaultEventsMap does not resolve the conditional
    // FallbackToUntypedListener when E is a generic. Cast to any only here;
    // type safety is enforced by the hook signature above.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).on(event, wrapped);
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (socket as any).off(event, wrapped);
    };
    // The handler is intentionally not in deps; consumers stabilize via
    // useCallback when they need to. Adding it would re-bind every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, event]);
}
