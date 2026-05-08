"use client";

import { useCallback } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings as SettingsIcon } from "lucide-react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import type { NotificationItem } from "@aurahire/shared";

import { useUserNotifications } from "@/lib/realtime/use-user-notifications";
import { cn } from "@/lib/utils";

export interface SidebarNotificationsPopoverBodyProps {
  userId: string;
}

const NOTIFICATIONS_SETTINGS_PATH = "/settings/notifications";

/**
 * Notifications popover content — Inbox / Archive tabs, click-to-read row,
 * and an "Archive all" footer. Lazy-fetches the archive tab the first time
 * the user opens it (the hook owns the cache; this component only renders).
 */
export function SidebarNotificationsPopoverBody({
  userId,
}: SidebarNotificationsPopoverBodyProps) {
  const router = useRouter();
  const {
    inbox,
    archive,
    unreadCount,
    unreadDisplayCount,
    fetchArchive,
    markRead,
    archiveOne,
    archiveAll,
    isArchivingAll,
  } = useUserNotifications(userId);

  const handleRowClick = useCallback(
    (n: NotificationItem) => {
      if (!n.readAt) markRead(n.id);
      if (n.link) router.push(n.link);
    },
    [markRead, router],
  );

  const handleTabChange = useCallback(
    (value: string | number | null) => {
      if (value === "archive") {
        // The hook gates archive fetching behind this call.
        void fetchArchive();
      }
    },
    [fetchArchive],
  );

  return (
    <TabsPrimitive.Root
      defaultValue="inbox"
      onValueChange={handleTabChange}
      className="flex max-h-[80vh] flex-col"
    >
      <div className="flex items-center justify-between border-b border-[var(--color-hairline-soft)] px-4 py-3">
        <TabsPrimitive.List className="flex items-center gap-4">
          <TabsPrimitive.Tab
            value="inbox"
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-muted)] transition aria-selected:font-semibold aria-selected:text-[var(--color-ink)] aria-selected:underline aria-selected:underline-offset-4"
          >
            <span>Inbox</span>
            {unreadCount > 0 ? (
              <span className="rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-1.5 py-0.5 text-xs font-semibold text-[var(--color-ink)]">
                {unreadDisplayCount}
              </span>
            ) : null}
          </TabsPrimitive.Tab>
          <TabsPrimitive.Tab
            value="archive"
            className="text-sm font-medium text-[var(--color-muted)] transition aria-selected:font-semibold aria-selected:text-[var(--color-ink)] aria-selected:underline aria-selected:underline-offset-4"
          >
            Archive
          </TabsPrimitive.Tab>
        </TabsPrimitive.List>
        <Link
          href={NOTIFICATIONS_SETTINGS_PATH}
          className="rounded-[var(--radius-sm)] p-1 text-[var(--color-muted)] transition hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]"
          aria-label="Notification settings"
        >
          <SettingsIcon className="h-4 w-4" />
        </Link>
      </div>

      <TabsPrimitive.Panel
        value="inbox"
        className="max-h-[60vh] overflow-y-auto"
      >
        {inbox.length === 0 ? (
          <EmptyState>
            No new notifications. We&rsquo;ll let you know when something happens.
          </EmptyState>
        ) : (
          inbox.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onClick={() => handleRowClick(n)}
              onArchive={() => archiveOne(n.id)}
            />
          ))
        )}
      </TabsPrimitive.Panel>

      <TabsPrimitive.Panel
        value="archive"
        className="max-h-[60vh] overflow-y-auto"
      >
        {archive.length === 0 ? (
          <EmptyState>No archived notifications yet.</EmptyState>
        ) : (
          archive.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onClick={() => handleRowClick(n)}
            />
          ))
        )}
      </TabsPrimitive.Panel>

      {inbox.length > 0 ? (
        <div className="border-t border-[var(--color-hairline-soft)] p-3">
          <button
            type="button"
            onClick={() => archiveAll()}
            disabled={isArchivingAll}
            className="w-full rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-hairline)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isArchivingAll ? "Archiving\u2026" : "Archive all"}
          </button>
        </div>
      ) : null}
    </TabsPrimitive.Root>
  );
}

interface NotificationRowProps {
  notification: NotificationItem;
  onClick: () => void;
  onArchive?: () => void;
}

function NotificationRow({ notification, onClick }: NotificationRowProps) {
  const isUnread = !notification.readAt;
  const ts = relativeTime(notification.createdAt);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 border-b border-[var(--color-hairline-soft)] px-4 py-3 text-left transition hover:bg-[var(--color-surface-soft)]",
        "last:border-b-0",
      )}
    >
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm",
            isUnread
              ? "font-semibold text-[var(--color-ink)]"
              : "font-medium text-[var(--color-body)]",
          )}
        >
          {notification.title}
        </p>
        {notification.body ? (
          <p className="mt-0.5 line-clamp-2 text-sm text-[var(--color-muted)]">
            {notification.body}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-[var(--color-muted)]">{ts}</p>
      </div>
      {isUnread ? (
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]"
          aria-label="Unread"
        />
      ) : null}
    </button>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-12 text-center text-sm text-[var(--color-muted)]">
      {children}
    </div>
  );
}

/**
 * Lightweight relative-time formatter. Mirrors the helper in
 * `app/(admin)/admin/_dashboard-client.tsx` so we don't pull in date-fns just
 * for a notifications popover.
 */
function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  if (Number.isNaN(then)) return "";
  if (diffMs < 0) return new Date(iso).toLocaleString();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
