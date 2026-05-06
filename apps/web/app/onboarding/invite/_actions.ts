"use server";

import { cookies } from "next/headers";

import { PENDING_INVITE_COOKIE } from "@/lib/invite-cookie";

/**
 * Clears the pendingInviteToken cookie. Invoked from the client after the
 * user accepts, declines, or explicitly chooses to create a company instead
 * — at all of those moments the cookie has served its purpose and shouldn't
 * survive into the next sign-in cycle.
 */
export async function clearPendingInviteCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_INVITE_COOKIE);
}
