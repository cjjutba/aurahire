"use client";

import type { Socket } from "socket.io-client";

export interface SubscribeOptions {
  resource: "job";
  id: string;
}

/**
 * Sends a `subscribe` message to the server and returns a function that
 * sends the matching `unsubscribe`. Idempotent on the server, safe to call
 * after every reconnect.
 */
export function subscribeToResource(
  socket: Socket,
  opts: SubscribeOptions,
): () => void {
  socket.emit("subscribe", opts);
  return () => {
    socket.emit("unsubscribe", opts);
  };
}
