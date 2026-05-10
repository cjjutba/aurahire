"use client";

import { useCallback, useRef } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import {
  RealtimeEvent,
  type ListNotificationsResponse,
  type NotificationArchiveAllPayload,
  type NotificationArchivedPayload,
  type NotificationCreatedPayload,
  type NotificationItem,
  type NotificationReadPayload,
  type UnreadCountResponse,
} from "@aurahire/shared";

import { clientApiFetch } from "@/hooks/_client-fetch";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";

const inboxKey = (userId: string) =>
  ["notifications", "inbox", userId] as const;
const archiveKey = (userId: string) =>
  ["notifications", "archive", userId] as const;
const unreadKey = (userId: string) =>
  ["notifications", "unread-count", userId] as const;

interface UnreadCountResultRelaxed {
  /** Server returns `count`. */
  count: number;
  /** Server may also include `displayCount`. Optional for client-side cache writes. */
  displayCount?: string;
}

export interface UseUserNotificationsResult {
  /** Inbox tab rows — auto-prepended on `notification.created`. */
  inbox: NotificationItem[];
  /** Archive tab rows — empty until `fetchArchive()` is called. */
  archive: NotificationItem[];
  /** Live unread badge count. */
  unreadCount: number;
  /** Display string capped at "99+" (matches the unread-count endpoint). */
  unreadDisplayCount: string;
  isLoadingInbox: boolean;
  isLoadingArchive: boolean;
  isLoadingUnreadCount: boolean;
  /** Lazily fetch (or refetch) the archive tab. Returns the query result for ergonomics. */
  fetchArchive: () => Promise<
    UseQueryResult<ListNotificationsResponse>["data"]
  >;
  /** Mark a single notification as read. */
  markRead: (id: string) => void;
  markReadAsync: (id: string) => Promise<void>;
  /** Archive a single notification. */
  archiveOne: (id: string) => void;
  archiveOneAsync: (id: string) => Promise<void>;
  /** Archive every undismissed notification for the user in one call. */
  archiveAll: () => void;
  archiveAllAsync: () => Promise<void>;
  isMarkingRead: boolean;
  isArchiving: boolean;
  isArchivingAll: boolean;
}

const NOTIFICATIONS_PATH = "/api/v1/notifications";

/**
 * Owns the user-scoped notifications cache + realtime sync.
 *
 * - Inbox is fetched eagerly (active tab in the popover).
 * - Archive is fetched lazily via `fetchArchive()` so opening a tab triggers
 *   the network request, not the page mount.
 * - Realtime events scope strictly to the supplied `userId` to defend
 *   against stale subscriptions after a sign-out/sign-in within the same
 *   socket lifetime.
 *
 * All cache writes are immutable so React Query's referential-equality
 * checks fire correctly.
 */
export function useUserNotifications(
  userId: string | null | undefined,
): UseUserNotificationsResult {
  const qc = useQueryClient();
  const enabledUserId = userId ?? "";

  const inbox = useQuery({
    queryKey: inboxKey(enabledUserId),
    queryFn: ({ signal }) =>
      clientApiFetch<ListNotificationsResponse>(NOTIFICATIONS_PATH, {
        query: { tab: "inbox", limit: 50 },
        signal,
      }),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

  const archive = useQuery({
    queryKey: archiveKey(enabledUserId),
    queryFn: ({ signal }) =>
      clientApiFetch<ListNotificationsResponse>(NOTIFICATIONS_PATH, {
        query: { tab: "archive", limit: 50 },
        signal,
      }),
    enabled: false, // lazy
    staleTime: 30_000,
  });

  const unreadCount = useQuery({
    queryKey: unreadKey(enabledUserId),
    queryFn: ({ signal }) =>
      clientApiFetch<UnreadCountResponse>(
        `${NOTIFICATIONS_PATH}/unread-count`,
        {
          signal,
        },
      ),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      clientApiFetch<UnreadCountResponse & { unreadCount: number }>(
        `${NOTIFICATIONS_PATH}/${id}/read`,
        { method: "POST" },
      ),
    onSuccess: (data) => {
      if (!userId) return;
      // Server already emitted `notification.read` to the user's room;
      // patching here is a fast-path so the local tab feels instant
      // without waiting for the websocket round-trip.
      qc.setQueryData(unreadKey(userId), {
        count: data.count,
        displayCount: data.displayCount,
      } satisfies UnreadCountResultRelaxed);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      clientApiFetch<UnreadCountResponse & { unreadCount: number }>(
        `${NOTIFICATIONS_PATH}/${id}/archive`,
        { method: "PATCH" },
      ),
    onSuccess: (data, id) => {
      if (!userId) return;
      qc.setQueryData(unreadKey(userId), {
        count: data.count,
        displayCount: data.displayCount,
      } satisfies UnreadCountResultRelaxed);
      // Optimistically remove the archived row from the inbox cache.
      qc.setQueryData<ListNotificationsResponse | undefined>(
        inboxKey(userId),
        (old) =>
          old ? { ...old, items: old.items.filter((n) => n.id !== id) } : old,
      );
    },
  });

  const archiveAllMutation = useMutation({
    mutationFn: () =>
      clientApiFetch<UnreadCountResponse & { unreadCount: number }>(
        `${NOTIFICATIONS_PATH}/archive-all`,
        { method: "POST" },
      ),
    onSuccess: () => {
      if (!userId) return;
      qc.setQueryData(unreadKey(userId), {
        count: 0,
        displayCount: "0",
      } satisfies UnreadCountResultRelaxed);
      qc.setQueryData<ListNotificationsResponse | undefined>(
        inboxKey(userId),
        (old) =>
          old ? { ...old, items: [] } : { items: [], nextCursor: null },
      );
    },
  });

  // userId mirror so the realtime handlers always see the freshest scope
  // even though `useRealtimeChannel` does not re-subscribe when userId
  // changes (handler intentionally not in its effect deps).
  const userIdRef = useRef<string | null | undefined>(userId);
  userIdRef.current = userId;

  const onCreated = useCallback(
    (payload: NotificationCreatedPayload) => {
      const current = userIdRef.current;
      if (!current || payload.userId !== current) return;

      // Map the realtime payload onto a NotificationItem-shaped row so the
      // popover can render it without re-fetching. We deliberately fill
      // unknown fields (eventType narrowed off `kind`, scope, body, etc.)
      // with safe defaults — the next inbox refetch overwrites this.
      const optimistic: NotificationItem = {
        id: payload.id,
        eventType: payload.kind as NotificationItem["eventType"],
        scope: "personal",
        title: payload.title,
        body: payload.bodyExcerpt,
        link: payload.linkUrl,
        entityType: null,
        entityId: null,
        actorId: null,
        metadata: null,
        readAt: null,
        createdAt: payload.createdAt,
      };

      qc.setQueryData<ListNotificationsResponse | undefined>(
        inboxKey(current),
        (old) => {
          const base: ListNotificationsResponse = old ?? {
            items: [],
            nextCursor: null,
          };
          // Guard against duplicate inserts if the row is already present.
          if (base.items.some((n) => n.id === optimistic.id)) return base;
          return { ...base, items: [optimistic, ...base.items] };
        },
      );

      qc.setQueryData(unreadKey(current), {
        count: payload.unreadCount,
        displayCount:
          payload.unreadCount > 99 ? "99+" : String(payload.unreadCount),
      } satisfies UnreadCountResultRelaxed);
    },
    [qc],
  );

  const onRead = useCallback(
    (payload: NotificationReadPayload) => {
      const current = userIdRef.current;
      if (!current) return;

      qc.setQueryData(unreadKey(current), {
        count: payload.unreadCount,
        displayCount:
          payload.unreadCount > 99 ? "99+" : String(payload.unreadCount),
      } satisfies UnreadCountResultRelaxed);

      const nowIso = new Date().toISOString();
      const markRead = (
        old: ListNotificationsResponse | undefined,
      ): ListNotificationsResponse | undefined => {
        if (!old) return old;
        let touched = false;
        const items = old.items.map((n) => {
          if (n.id !== payload.id || n.readAt) return n;
          touched = true;
          return { ...n, readAt: nowIso };
        });
        return touched ? { ...old, items } : old;
      };
      qc.setQueryData<ListNotificationsResponse | undefined>(
        inboxKey(current),
        markRead,
      );
      qc.setQueryData<ListNotificationsResponse | undefined>(
        archiveKey(current),
        markRead,
      );
    },
    [qc],
  );

  const onArchived = useCallback(
    (payload: NotificationArchivedPayload) => {
      const current = userIdRef.current;
      if (!current) return;

      qc.setQueryData(unreadKey(current), {
        count: payload.unreadCount,
        displayCount:
          payload.unreadCount > 99 ? "99+" : String(payload.unreadCount),
      } satisfies UnreadCountResultRelaxed);
      qc.setQueryData<ListNotificationsResponse | undefined>(
        inboxKey(current),
        (old) =>
          old
            ? { ...old, items: old.items.filter((n) => n.id !== payload.id) }
            : old,
      );
      // The archive tab is lazy, but if it has been hydrated we should
      // invalidate so the archived row appears the next time the user
      // opens that tab.
      qc.invalidateQueries({ queryKey: archiveKey(current) });
    },
    [qc],
  );

  const onArchiveAll = useCallback(
    (_payload: NotificationArchiveAllPayload) => {
      const current = userIdRef.current;
      if (!current) return;
      qc.setQueryData(unreadKey(current), {
        count: 0,
        displayCount: "0",
      } satisfies UnreadCountResultRelaxed);
      qc.setQueryData<ListNotificationsResponse | undefined>(
        inboxKey(current),
        (old) =>
          old ? { ...old, items: [] } : { items: [], nextCursor: null },
      );
      qc.invalidateQueries({ queryKey: archiveKey(current) });
    },
    [qc],
  );

  useRealtimeChannel(RealtimeEvent.NotificationCreated, onCreated);
  useRealtimeChannel(RealtimeEvent.NotificationRead, onRead);
  useRealtimeChannel(RealtimeEvent.NotificationArchived, onArchived);
  useRealtimeChannel(RealtimeEvent.NotificationArchiveAll, onArchiveAll);

  const inboxItems: NotificationItem[] = inbox.data?.items ?? [];
  const archiveItems: NotificationItem[] = archive.data?.items ?? [];
  const unread = unreadCount.data?.count ?? 0;
  const unreadDisplay =
    unreadCount.data?.displayCount ?? (unread > 99 ? "99+" : String(unread));

  return {
    inbox: inboxItems,
    archive: archiveItems,
    unreadCount: unread,
    unreadDisplayCount: unreadDisplay,
    isLoadingInbox: inbox.isLoading,
    isLoadingArchive: archive.isLoading,
    isLoadingUnreadCount: unreadCount.isLoading,
    fetchArchive: async () => {
      const result = await archive.refetch();
      return result.data;
    },
    markRead: (id) => {
      markReadMutation.mutate(id);
    },
    markReadAsync: async (id) => {
      await markReadMutation.mutateAsync(id);
    },
    archiveOne: (id) => {
      archiveMutation.mutate(id);
    },
    archiveOneAsync: async (id) => {
      await archiveMutation.mutateAsync(id);
    },
    archiveAll: () => {
      archiveAllMutation.mutate();
    },
    archiveAllAsync: async () => {
      await archiveAllMutation.mutateAsync();
    },
    isMarkingRead: markReadMutation.isPending,
    isArchiving: archiveMutation.isPending,
    isArchivingAll: archiveAllMutation.isPending,
  };
}
