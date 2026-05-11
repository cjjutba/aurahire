"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Socket } from "socket.io-client";

import { makeSocket, type SocketStatus } from "@/lib/realtime";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

interface SocketContextValue {
  socket: Socket | null;
  status: SocketStatus;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  status: "idle",
});

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}

/**
 * Owns the singleton socket lifecycle for a tab.
 *
 * Token plumbing: AuthTokenProvider writes the access token into a
 * module-level singleton (@aurahire/shared fetcher), that's not reactive
 * React state. This provider subscribes to Supabase auth state changes
 * directly (same pattern as AuthTokenProvider) so React re-renders happen
 * when the token changes.
 *
 * Lifecycle:
 *  - Token absent  → no socket. Status `idle`.
 *  - Token present → create socket, autoConnect=false, then connect.
 *  - Token rotated → effect cleanup tears down the prior socket; the next
 *    effect run lazy-creates a fresh socket which presents the new token at
 *    handshake. (We considered reusing the same socket and calling
 *    disconnect/connect, but the cleanup runs first either way, so a fresh
 *    instance is the simpler path.)
 *  - User signs out → token becomes null → disconnect + null out the socket.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [token, setToken] = useState<string | null>(null);

  // Sync reactive token state with Supabase auth changes.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<SocketStatus>("idle");

  // Stable getter so the auth callback in makeSocket always reads the
  // freshest token on every (re)connect, including post-refresh.
  const tokenRef = useRef<string | null>(token);
  tokenRef.current = token;

  useEffect(() => {
    if (!token) {
      // Sign-out path: tear down the socket if any.
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setStatus("idle");
      }
      return;
    }

    // Lazy-create. Effect cleanup nulls the ref on token change, so on
    // rotation we land here again with a fresh instance.
    const sock = makeSocket({ getToken: () => tokenRef.current });
    sock.on("connect", () => setStatus("connected"));
    sock.on("disconnect", () => setStatus("disconnected"));
    sock.on("connect_error", (err) => {
      const code =
        (err as { data?: { code?: string } }).data?.code ?? err.message;
      setStatus(code === "UNAUTHORIZED" ? "unauthorized" : "disconnected");
    });
    // Server-emitted RBAC rejection (subscribed to a job the user doesn't own,
    // rate-limited, etc.). Surface as a console.warn so ops can spot silent
    // RBAC violations during smoke tests; never throws.
    sock.on(
      "subscribe_error",
      (err: { resource?: string; id?: string; reason?: string }) => {
        // eslint-disable-next-line no-console
        console.warn(
          `[realtime] subscribe_error reason=${err.reason ?? "unknown"} resource=${err.resource ?? "-"} id=${err.id ?? "-"}`,
        );
      },
    );
    socketRef.current = sock;
    setStatus("connecting");
    sock.connect();
    return () => {
      sock.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const value = useMemo<SocketContextValue>(
    () => ({ socket: socketRef.current, status }),
    [status],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}
