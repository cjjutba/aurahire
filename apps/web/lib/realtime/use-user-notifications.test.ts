import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { EventEmitter } from "node:events";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { RealtimeEvent } from "@aurahire/shared";

class FakeSocket extends EventEmitter {}
const fakeSocket = new FakeSocket();

vi.mock("@/components/providers/socket-provider", () => ({
  useSocket: () => ({ socket: fakeSocket, status: "connected" }),
}));

const fetchMock = vi.fn();
vi.mock("@/hooks/_client-fetch", () => ({
  clientApiFetch: (...args: unknown[]) => fetchMock(...args),
}));

import { useUserNotifications } from "./use-user-notifications";

const USER_ID = "55555555-5555-5555-5555-555555555555";
const OTHER_USER_ID = "66666666-6666-6666-6666-666666666666";
const NOTIFICATION_ID = "77777777-7777-7777-7777-777777777777";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client }, children);
  return { client, Wrapper };
}

function emptyList() {
  return { items: [], nextCursor: null };
}

function emptyUnreadCount() {
  return { count: 0, displayCount: "0" };
}

describe("useUserNotifications", () => {
  beforeEach(() => {
    fakeSocket.removeAllListeners();
    fetchMock.mockReset();
    // Default fetch responder: respect the requested path so each query
    // resolves with an empty inbox / archive / unread-count payload.
    fetchMock.mockImplementation((path: string, init?: { method?: string }) => {
      if (path.endsWith("/notifications/unread-count")) {
        return Promise.resolve(emptyUnreadCount());
      }
      if (path.endsWith("/notifications") || path.includes("/notifications?")) {
        return Promise.resolve(emptyList());
      }
      if (init?.method === "POST" || init?.method === "PATCH") {
        return Promise.resolve({ count: 0, displayCount: "0", unreadCount: 0 });
      }
      return Promise.resolve(emptyList());
    });
  });

  it("renders zero unread count when user has no notifications", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUserNotifications(USER_ID), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoadingInbox).toBe(false);
    });
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.inbox).toEqual([]);
    expect(result.current.archive).toEqual([]);
  });

  it("on notification.created, prepends to inbox and updates unreadCount", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUserNotifications(USER_ID), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoadingInbox).toBe(false);
    });

    act(() => {
      fakeSocket.emit(RealtimeEvent.NotificationCreated, {
        id: NOTIFICATION_ID,
        userId: USER_ID,
        kind: "application_status_changed",
        title: "Status changed",
        bodyExcerpt: "Your application moved to Screening.",
        linkUrl: "/candidate/applications/abc",
        createdAt: new Date().toISOString(),
        unreadCount: 1,
      });
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(1);
    });
    expect(result.current.inbox).toHaveLength(1);
    expect(result.current.inbox[0]?.id).toBe(NOTIFICATION_ID);
    expect(result.current.inbox[0]?.title).toBe("Status changed");
  });

  it("ignores notification.created events targeted at a different user", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUserNotifications(USER_ID), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoadingInbox).toBe(false);
    });

    act(() => {
      fakeSocket.emit(RealtimeEvent.NotificationCreated, {
        id: NOTIFICATION_ID,
        userId: OTHER_USER_ID, // wrong user
        kind: "application_status_changed",
        title: "Status changed",
        bodyExcerpt: "...",
        linkUrl: null,
        createdAt: new Date().toISOString(),
        unreadCount: 5,
      });
    });

    expect(result.current.inbox).toHaveLength(0);
    expect(result.current.unreadCount).toBe(0);
  });

  it("on notification.read, refreshes the unread count", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUserNotifications(USER_ID), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoadingInbox).toBe(false);
    });

    // First push a notification so we have unreadCount = 1
    act(() => {
      fakeSocket.emit(RealtimeEvent.NotificationCreated, {
        id: NOTIFICATION_ID,
        userId: USER_ID,
        kind: "application_status_changed",
        title: "n",
        bodyExcerpt: "n",
        linkUrl: null,
        createdAt: new Date().toISOString(),
        unreadCount: 1,
      });
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(1);
    });

    act(() => {
      fakeSocket.emit(RealtimeEvent.NotificationRead, {
        id: NOTIFICATION_ID,
        unreadCount: 0,
      });
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0);
    });
    expect(result.current.inbox[0]?.readAt).not.toBeNull();
  });

  it("on notification.archived, removes the row from inbox cache and updates unreadCount", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUserNotifications(USER_ID), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoadingInbox).toBe(false);
    });

    act(() => {
      fakeSocket.emit(RealtimeEvent.NotificationCreated, {
        id: NOTIFICATION_ID,
        userId: USER_ID,
        kind: "application_status_changed",
        title: "n",
        bodyExcerpt: "n",
        linkUrl: null,
        createdAt: new Date().toISOString(),
        unreadCount: 1,
      });
    });

    await waitFor(() => {
      expect(result.current.inbox).toHaveLength(1);
    });

    act(() => {
      fakeSocket.emit(RealtimeEvent.NotificationArchived, {
        id: NOTIFICATION_ID,
        unreadCount: 0,
      });
    });

    await waitFor(() => {
      expect(result.current.inbox).toHaveLength(0);
    });
    expect(result.current.unreadCount).toBe(0);
  });

  it("on notification.archive_all, drops the inbox to empty and unreadCount to 0", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUserNotifications(USER_ID), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoadingInbox).toBe(false);
    });

    // Seed with one realtime-created row.
    act(() => {
      fakeSocket.emit(RealtimeEvent.NotificationCreated, {
        id: NOTIFICATION_ID,
        userId: USER_ID,
        kind: "application_status_changed",
        title: "n",
        bodyExcerpt: "n",
        linkUrl: null,
        createdAt: new Date().toISOString(),
        unreadCount: 1,
      });
    });

    await waitFor(() => {
      expect(result.current.inbox).toHaveLength(1);
    });

    act(() => {
      fakeSocket.emit(RealtimeEvent.NotificationArchiveAll, { unreadCount: 0 });
    });

    await waitFor(() => {
      expect(result.current.inbox).toHaveLength(0);
    });
    expect(result.current.unreadCount).toBe(0);
  });

  it("fetchArchive triggers a request to the archive tab", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUserNotifications(USER_ID), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoadingInbox).toBe(false);
    });

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce({
      items: [
        {
          id: NOTIFICATION_ID,
          eventType: "application_status_changed",
          scope: "personal",
          title: "old archived",
          body: "old",
          link: null,
          entityType: null,
          entityId: null,
          actorId: null,
          metadata: null,
          readAt: null,
          createdAt: new Date().toISOString(),
        },
      ],
      nextCursor: null,
    });

    await act(async () => {
      await result.current.fetchArchive();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/notifications",
      expect.objectContaining({
        query: expect.objectContaining({ tab: "archive" }),
      }),
    );
    await waitFor(() => {
      expect(result.current.archive).toHaveLength(1);
    });
  });

  it("markRead calls POST /:id/read", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUserNotifications(USER_ID), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoadingInbox).toBe(false);
    });

    fetchMock.mockClear();
    fetchMock.mockResolvedValue({
      count: 0,
      displayCount: "0",
      unreadCount: 0,
    });

    await act(async () => {
      await result.current.markReadAsync(NOTIFICATION_ID);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/notifications/${NOTIFICATION_ID}/read`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("archiveOne calls PATCH /:id/archive", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUserNotifications(USER_ID), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoadingInbox).toBe(false);
    });

    fetchMock.mockClear();
    fetchMock.mockResolvedValue({
      count: 0,
      displayCount: "0",
      unreadCount: 0,
    });

    await act(async () => {
      await result.current.archiveOneAsync(NOTIFICATION_ID);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/notifications/${NOTIFICATION_ID}/archive`,
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("archiveAll calls POST /archive-all", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUserNotifications(USER_ID), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoadingInbox).toBe(false);
    });

    fetchMock.mockClear();
    fetchMock.mockResolvedValue({
      count: 0,
      displayCount: "0",
      unreadCount: 0,
    });

    await act(async () => {
      await result.current.archiveAllAsync();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/notifications/archive-all",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("does not fetch when userId is null", async () => {
    const { Wrapper } = makeWrapper();
    fetchMock.mockClear();
    const { result } = renderHook(() => useUserNotifications(null), {
      wrapper: Wrapper,
    });

    // Give react-query a tick to NOT fire.
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.unreadCount).toBe(0);
  });
});
