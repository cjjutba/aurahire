import { startInviteSignup } from "./_signup-redirect";

/**
 * Server component rendering a `<form>` that POSTs to the
 * `startInviteSignup` server action. The action stamps the
 * pendingInviteToken cookie and redirects to /register.
 *
 * Plain HTML form so the path works with client-side JS disabled too.
 */
export function SignupRedirectForm({ token }: { token: string }) {
  return (
    <form
      action={startInviteSignup.bind(null, token)}
      className="flex flex-col gap-3"
    >
      <button
        type="submit"
        className="inline-flex h-12 w-full items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-base font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-active)]"
      >
        Sign up to accept
      </button>
      <p className="text-center text-xs text-[var(--color-muted)]">
        Already have an account?{" "}
        <a
          href="/login"
          className="text-[var(--color-primary)] hover:underline"
        >
          Sign in
        </a>{" "}
       , we'll bring you back here.
      </p>
    </form>
  );
}
