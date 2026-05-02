"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Breadcrumb } from "./breadcrumb";

interface PortalTopbarProps {
  fullName: string;
  email: string;
}

export function PortalTopbar({ fullName, email }: PortalTopbarProps) {
  const router = useRouter();
  const initials = getInitials(fullName);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Sign out failed", { description: error.message });
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-[var(--color-hairline)] bg-[var(--color-canvas)] px-6">
      <Breadcrumb />
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex items-center gap-2 rounded-[var(--radius-full)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              />
            }
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-[var(--color-surface-strong)] text-sm font-semibold text-[var(--color-ink)]">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="font-semibold text-[var(--color-ink)]">
                  {fullName}
                </div>
                <div className="text-xs font-normal text-[var(--color-muted)]">
                  {email}
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
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
