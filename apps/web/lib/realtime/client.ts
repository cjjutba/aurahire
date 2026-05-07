"use client";

import { io, type Socket } from "socket.io-client";

export type SocketStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "unauthorized";

/**
 * Builds the websocket URL from NEXT_PUBLIC_API_URL. Socket.io accepts the
 * https/http origin directly and chooses ws/wss + transport internally.
 */
function buildSocketUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  return apiUrl;
}

export interface MakeSocketOptions {
  getToken: () => string | null;
}

export function makeSocket(opts: MakeSocketOptions): Socket {
  return io(buildSocketUrl(), {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    auth: (cb) => {
      const token = opts.getToken();
      cb({ token });
    },
  });
}
