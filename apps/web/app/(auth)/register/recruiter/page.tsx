import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { AuthRoleTag } from "@/components/auth/auth-role-tag";
import { RegisterRecruiterForm } from "@/components/auth/register-recruiter-form";

export const metadata = { title: "Sign Up as Recruiter" };

export default function RegisterRecruiterPage() {
  return (
    <AuthShell
      topSlot={<AuthRoleTag>Recruiter</AuthRoleTag>}
      title="Sign up as a recruiter"
      subtitle="Post jobs and find qualified candidates with bias mitigation built in."
      footer={
        <span>
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--color-primary)] hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <RegisterRecruiterForm />
    </AuthShell>
  );
}
