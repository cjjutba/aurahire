"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  HelpCircle,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Smile,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import type { UserRole } from "@aurahire/shared";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { setSessionOnlyMarker } from "@/lib/auth/cookie-persistence.client";
import { setActiveCompanyId } from "@/lib/active-company";
import { toastApiError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

export interface SidebarProfilePopoverUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
}

export interface SidebarProfilePopoverBodyProps {
  user: SidebarProfilePopoverUser;
  /** Invoked after Supabase sign-out succeeds. */
  onSignedOut?: () => void;
}

const SETTINGS_PATH: Record<UserRole, string> = {
  candidate: "/candidate/settings/profile",
  recruiter: "/recruiter/settings/profile",
  admin: "/admin/settings/profile",
};

const HELP_PATH: Record<UserRole, string> = {
  candidate: "/candidate/help",
  recruiter: "/recruiter/help",
  admin: "/admin/help",
};

const HOW_IT_WORKS_PATH = "/how-it-works";

const FEEDBACK_MAILTO =
  "mailto:cjjutbaofficial@gmail.com?subject=AuraHire%20feedback";

/**
 * Profile popover content — used by both the avatar/name trigger and the
 * three-dot trigger in `SidebarBottomRail`. Lives outside the `<Popover>` so
 * the rail can re-use the same body in two `<Popover>` wrappers.
 */
export function SidebarProfilePopoverBody({
  user,
  onSignedOut,
}: SidebarProfilePopoverBodyProps) {
  const router = useRouter();
  const initials = getInitials(user.name);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toastApiError(error, "Sign out failed");
      return;
    }
    setSessionOnlyMarker(false);
    setActiveCompanyId(null);
    toastSuccess("Signed out");
    onSignedOut?.();
    router.push("/");
    router.refresh();
  }

  return (
    <div>
      {/* Header: avatar + name + email + settings shortcut */}
      <div className="mb-4 flex items-start gap-3">
        <Avatar size="lg">
          {user.avatarUrl ? (
            <AvatarImage src={user.avatarUrl} alt={user.name} />
          ) : null}
          <AvatarFallback className="bg-[var(--color-surface-strong)] text-sm font-semibold text-[var(--color-ink)]">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-[var(--color-ink)]">
            {user.name}
          </p>
          <p className="truncate text-sm text-[var(--color-muted)]">
            {user.email}
          </p>
        </div>
        <Link
          href={SETTINGS_PATH[user.role]}
          className="rounded-[var(--radius-sm)] p-1 text-[var(--color-muted)] transition hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>

      <div className="space-y-1">
        <a
          href={FEEDBACK_MAILTO}
          className="flex items-center justify-between rounded-[var(--radius-sm)] px-2 py-2 text-sm text-[var(--color-ink)] transition hover:bg-[var(--color-surface-soft)]"
        >
          <span>Send feedback</span>
          <Smile className="h-4 w-4 text-[var(--color-muted)]" />
        </a>

        <ThemeRow />

        <Link
          href={HOW_IT_WORKS_PATH}
          className="flex items-center justify-between rounded-[var(--radius-sm)] px-2 py-2 text-sm text-[var(--color-ink)] transition hover:bg-[var(--color-surface-soft)]"
        >
          <span>How it works</span>
          <BookOpen className="h-4 w-4 text-[var(--color-muted)]" />
        </Link>

        <Link
          href={HELP_PATH[user.role]}
          className="flex items-center justify-between rounded-[var(--radius-sm)] px-2 py-2 text-sm text-[var(--color-ink)] transition hover:bg-[var(--color-surface-soft)]"
        >
          <span>Help</span>
          <HelpCircle className="h-4 w-4 text-[var(--color-muted)]" />
        </Link>

        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2 py-2 text-left text-sm text-[var(--color-ink)] transition hover:bg-[var(--color-surface-soft)]"
        >
          <span>Log out</span>
          <LogOut className="h-4 w-4 text-[var(--color-muted)]" />
        </button>
      </div>

      <div className="mt-4 border-t border-[var(--color-hairline-soft)] pt-3">
        <AiStatusPill />
      </div>
    </div>
  );
}

function ThemeRow() {
  const { theme, setTheme } = useTheme();
  const active = theme ?? "system";
  const buttons: Array<{ value: string; label: string; Icon: typeof Sun }> = [
    { value: "system", label: "System theme", Icon: Monitor },
    { value: "light", label: "Light theme", Icon: Sun },
    { value: "dark", label: "Dark theme", Icon: Moon },
  ];
  return (
    <div className="flex items-center justify-between rounded-[var(--radius-sm)] px-2 py-2 text-sm text-[var(--color-ink)]">
      <span>Theme</span>
      <div className="flex items-center gap-1">
        {buttons.map(({ value, label, Icon }) => {
          const isActive = active === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={isActive}
              aria-label={label}
              className={cn(
                "rounded-full p-1 transition",
                isActive
                  ? "bg-[var(--color-surface-strong)] text-[var(--color-ink)]"
                  : "text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AiStatusPill() {
  // Static for thesis scope. Wire to /health/ai later if a live signal is
  // desired; the design system reserves green for "Strong Match" / success.
  return (
    <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
      <span>AI Status &mdash; All systems normal.</span>
      <span
        className="h-2 w-2 rounded-full bg-[var(--color-score-high)]"
        aria-hidden="true"
      />
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
