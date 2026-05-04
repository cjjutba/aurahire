import Link from "next/link";
import { Briefcase, User } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { AuthRoleCard } from "@/components/auth/auth-role-card";

export const metadata = { title: "Create Account" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Choose your role to get started."
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
        <AuthRoleCard
          href="/register/candidate"
          icon={User}
          title="I'm a Candidate"
          description="Looking for jobs and tracking applications."
        />
        <AuthRoleCard
          href="/register/recruiter"
          icon={Briefcase}
          title="I'm a Recruiter"
          description="Posting jobs and reviewing candidates."
        />
      </div>
    </AuthShell>
  );
}
