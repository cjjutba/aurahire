"use client";

import { useState } from "react";
import { Bell, MoreHorizontal } from "lucide-react";
import type { UserRole } from "@aurahire/shared";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUserNotifications } from "@/lib/realtime/use-user-notifications";

import { SidebarNotificationsPopoverBody } from "./sidebar-notifications-popover";
import { SidebarProfilePopoverBody } from "./sidebar-profile-popover";

export interface SidebarBottomRailUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
}

export interface SidebarBottomRailProps {
  user: SidebarBottomRailUser;
  /**
   * Optional callback invoked when the user signs out, after the Supabase
   * session is destroyed. Lets the host portal navigate away or refresh.
   */
  onSignedOut?: () => void;
}

/**
 * Vercel-style sidebar bottom rail: avatar + name (clickable, opens profile),
 * three-dot button (alternate trigger for the same profile popover), and a
 * bell with an unread-count dot that opens the notifications popover.
 *
 * The avatar/name and three-dot buttons render the SAME profile popover
 * content so the choice between them is purely affordance — clicking either
 * yields identical behavior.
 */
export function SidebarBottomRail({ user, onSignedOut }: SidebarBottomRailProps) {
  const { unreadCount } = useUserNotifications(user.id);
  const initials = getInitials(user.name);
  const bellLabel =
    unreadCount > 0
      ? `Notifications (${unreadCount} unread)`
      : "Notifications";

  // Controlled open state for the profile popover so the three-dot button
  // (rendered OUTSIDE the Popover root) can open the SAME popover that the
  // avatar/name trigger anchors. Without this, the three-dot would have its
  // own Popover and its content would float above the dot's position rather
  // than originate from the profile area.
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 border-t border-[var(--color-hairline-soft)] px-3 py-3">
      {/* Profile area: avatar + name (left) — owns the popover anchor */}
      <Popover open={profileOpen} onOpenChange={setProfileOpen}>
        <PopoverTrigger
          className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-md)] p-1 text-left transition hover:bg-[var(--color-surface-strong)]"
          aria-label="Open profile menu"
        >
          <Avatar size="default">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.name} />
            ) : null}
            <AvatarFallback className="bg-[var(--color-surface-strong)] text-xs font-semibold text-[var(--color-ink)]">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-sm font-semibold text-[var(--color-ink)]">
            {user.name}
          </span>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          className="w-80 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 shadow-md"
        >
          <SidebarProfilePopoverBody user={user} onSignedOut={onSignedOut} />
        </PopoverContent>
      </Popover>

      {/* Three-dot button: alternate trigger that opens the SAME popover.
          Lives outside the Popover root so it can't reposition the anchor. */}
      <button
        type="button"
        onClick={() => setProfileOpen((open) => !open)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-[var(--color-body)] transition hover:bg-[var(--color-hairline)] hover:text-[var(--color-ink)]"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={profileOpen}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {/* Bell button: opens notifications popover */}
      <Popover>
        <PopoverTrigger
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-[var(--color-body)] transition hover:bg-[var(--color-hairline)] hover:text-[var(--color-ink)]"
          aria-label={bellLabel}
          data-testid="bell-button"
          data-unread-count={unreadCount}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]"
              aria-hidden="true"
              data-testid="bell-unread-dot"
            />
          ) : null}
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={8}
          className="w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] shadow-md"
        >
          <SidebarNotificationsPopoverBody userId={user.id} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
