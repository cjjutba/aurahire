"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  PENDING_INVITE_COOKIE,
  PENDING_INVITE_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/invite-cookie";

/**
 * Server action invoked when a signed-out visitor clicks "Sign up to accept"
 * on an invite landing page. Persists the invite token as an HTTP-only cookie
 * so the post-signup onboarding flow can pick it up (`/onboarding/start`
 * forwards to `/onboarding/invite?token=...` when this cookie is present).
 *
 * Cookie shape:
 *   - HTTP-only (no XSS leak via `document.cookie`)
 *   - Path "/" so every page can read it
 *   - 1 hour TTL, the user is expected to complete signup within this window
 *   - sameSite "lax", survives a same-site navigation back from /register
 */
export async function startInviteSignup(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_INVITE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_INVITE_COOKIE_MAX_AGE_SECONDS,
  });
  redirect("/register");
}
