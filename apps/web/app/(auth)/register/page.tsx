import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata = { title: "Create Account" };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Choose your role to get started."
      footer={
        <span>
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--color-primary)] hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <div className="space-y-3">
        <Link
          href="/register/candidate"
          className="block rounded-[var(--radius-lg)] border border-[var(--color-hairline)] p-4 transition hover:bg-[var(--color-surface-soft)]"
        >
          <h3 className="font-semibold text-[var(--color-ink)]">I&apos;m a Candidate</h3>
          <p className="text-sm text-[var(--color-body)]">
            Looking for jobs and tracking applications.
          </p>
        </Link>
        <Link
          href="/register/recruiter"
          className="block rounded-[var(--radius-lg)] border border-[var(--color-hairline)] p-4 transition hover:bg-[var(--color-surface-soft)]"
        >
          <h3 className="font-semibold text-[var(--color-ink)]">I&apos;m a Recruiter</h3>
          <p className="text-sm text-[var(--color-body)]">
            Posting jobs and reviewing candidates.
          </p>
        </Link>
      </div>
    </AuthCard>
  );
}
