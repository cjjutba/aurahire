/**
 * The pendingInviteToken cookie persists an invitation token across
 * unauthenticated → authenticated transitions. Lifecycle:
 *
 *   1. Set by the public /invite/[token] page when a signed-out user clicks
 *      "Sign up to accept" (server action in
 *      apps/web/app/invite/[token]/_signup-redirect.ts).
 *   2. Read by /onboarding/start to fork the user into the invite flow
 *      instead of the create-vs-join chooser.
 *   3. Read by /onboarding/invite when no `?token` query param was supplied.
 *   4. Cleared by /onboarding/invite once the user accepts, declines, or
 *      explicitly chooses to create a company instead.
 *
 * Constants live here (not co-located with the server action) so server
 * components in onboarding/ and invite/ can both read the cookie name without
 * cross-importing route handlers.
 */
export const PENDING_INVITE_COOKIE = "pendingInviteToken";

/**
 * 1 hour, long enough to complete signup + email verification on a single
 * sitting, short enough that an abandoned tab doesn't carry the token forward
 * indefinitely.
 */
export const PENDING_INVITE_COOKIE_MAX_AGE_SECONDS = 60 * 60;
