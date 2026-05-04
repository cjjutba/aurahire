import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata = { title: "Check Your Email" };

interface PageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function VerifyEmailSentPage({ searchParams }: PageProps) {
  const { email } = await searchParams;

  return (
    <AuthCard title="Check your email">
      <div className="space-y-3 text-sm text-[var(--color-body)]">
        <p>
          We&apos;ve sent a verification link to{" "}
          <span className="font-semibold text-[var(--color-ink)]">{email ?? "your inbox"}</span>.
        </p>
        <p>
          Click the link in the email to activate your account. The link expires in 24 hours.
        </p>
        <p className="text-[var(--color-muted)]">
          Don&apos;t see it? Check your spam folder.
        </p>
      </div>
      <div className="mt-6 text-sm">
        <Link href="/login" className="text-[var(--color-primary)] hover:underline">
          Back to sign in
        </Link>
      </div>
    </AuthCard>
  );
}
