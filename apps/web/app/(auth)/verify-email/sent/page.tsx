import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResendVerificationButton } from "@/components/auth/resend-verification-button";

export const metadata = { title: "Check Your Inbox" };

interface PageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function VerifyEmailSentPage({ searchParams }: PageProps) {
  const { email } = await searchParams;

  return (
    <AuthShell
      title="Check your inbox"
      subtitle={
        <>
          We&apos;ve sent a verification link to{" "}
          <span className="font-semibold text-[var(--color-ink)]">
            {email ?? "your inbox"}
          </span>
          .
        </>
      }
    >
      <p className="mx-auto mb-8 max-w-[320px] text-center text-sm leading-relaxed text-[var(--color-body)]">
        Click the link in the email to activate your account. The link expires
        in 24 hours. Don&apos;t see it? Check your spam folder.
      </p>
      {email ? (
        <>
          <ResendVerificationButton email={email} />
          <div className="mt-4 text-center text-sm text-[var(--color-body)]">
            <Link
              href="/login"
              className="font-semibold text-[var(--color-primary)] hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        </>
      ) : (
        <Link
          href="/login"
          className="flex h-12 w-full items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-base font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-active)]"
        >
          Back to sign in
        </Link>
      )}
    </AuthShell>
  );
}
