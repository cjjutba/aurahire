"use client";

import { useEffect } from "react";

import { useSocket } from "@/components/providers/socket-provider";
import { subscribeToResource } from "@/lib/realtime";

type Resource = "job";

/**
 * Subscribes to a resource-scoped room (e.g., a single job) for the lifetime
 * of the calling component. Re-subscribes automatically on socket reconnect.
 *
 * Pass `id={null}` to no-op (useful when the parent renders before the id is known).
 */
export function useRealtimeRoom(resource: Resource, id: string | null): void {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !id) return;
    let cleanup: (() => void) | null = null;

    const subscribe = (): void => {
      cleanup?.();
      cleanup = subscribeToResource(socket, { resource, id });
    };

    subscribe();
    socket.on("connect", subscribe); // re-subscribe after reconnect

    return () => {
      socket.off("connect", subscribe);
      cleanup?.();
    };
  }, [socket, resource, id]);
}
