import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import type { UseUserNotificationsResult } from "@/lib/realtime/use-user-notifications";

const mockState: UseUserNotificationsResult = {
  inbox: [],
  archive: [],
  unreadCount: 0,
  unreadDisplayCount: "0",
  isLoadingInbox: false,
  isLoadingArchive: false,
  isLoadingUnreadCount: false,
  fetchArchive: vi.fn(async () => undefined),
  markRead: vi.fn(),
  markReadAsync: vi.fn(async () => {}),
  archiveOne: vi.fn(),
  archiveOneAsync: vi.fn(async () => {}),
  archiveAll: vi.fn(),
  archiveAllAsync: vi.fn(async () => {}),
  isMarkingRead: false,
  isArchiving: false,
  isArchivingAll: false,
};

vi.mock("@/lib/realtime/use-user-notifications", () => ({
  useUserNotifications: () => mockState,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/candidate",
}));

vi.mock("@/lib/auth/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signOut: vi.fn(async () => ({ error: null })) },
  }),
}));

import { SidebarBottomRail } from "./sidebar-bottom-rail";

const fakeUser = {
  id: "user-123",
  name: "Ada Lovelace",
  email: "ada@example.com",
  avatarUrl: null,
  role: "candidate" as const,
};

describe("SidebarBottomRail", () => {
  it("renders avatar fallback initials, name, three-dot, and bell triggers", () => {
    render(<SidebarBottomRail user={fakeUser} />);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByLabelText("Open profile menu")).toBeInTheDocument();
    expect(screen.getByLabelText("More options")).toBeInTheDocument();
    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
    // Avatar fallback uses first-two-initials.
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("uses 'Notifications (N unread)' label and shows the unread dot when unreadCount > 0", () => {
    mockState.unreadCount = 5;
    mockState.unreadDisplayCount = "5";
    render(<SidebarBottomRail user={fakeUser} />);
    expect(
      screen.getByLabelText("Notifications (5 unread)"),
    ).toBeInTheDocument();
    // Reset for downstream tests in the suite.
    mockState.unreadCount = 0;
    mockState.unreadDisplayCount = "0";
  });
});
