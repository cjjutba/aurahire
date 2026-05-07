"use client";

import { useSocket } from "@/components/providers/socket-provider";
import type { SocketStatus } from "@/lib/realtime";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<SocketStatus, string> = {
  idle: "Idle",
  connecting: "Connecting",
  connected: "Live",
  disconnected: "Offline",
  unauthorized: "Unauthorized",
};

const STATUS_DOT_CLASS: Record<SocketStatus, string> = {
  idle: "bg-[var(--color-muted)]",
  connecting: "bg-[var(--color-score-mid)] animate-pulse",
  connected: "bg-[var(--color-score-high)]",
  disconnected: "bg-[var(--color-score-low)]",
  unauthorized: "bg-[var(--color-score-low)]",
};

export function ConnectionStatusIndicator() {
  const { status } = useSocket();
  return (
    <span
      className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-3 py-1 text-xs font-medium text-[var(--color-body)]"
      role="status"
      aria-live="polite"
    >
      <span
        className={cn("h-2 w-2 rounded-full", STATUS_DOT_CLASS[status])}
        aria-hidden
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
