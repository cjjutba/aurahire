import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { AuthRoleTag } from "@/components/auth/auth-role-tag";
import { RegisterCandidateForm } from "@/components/auth/register-candidate-form";

export const metadata = { title: "Sign Up as Candidate" };

export default function RegisterCandidatePage() {
  return (
    <AuthShell
      topSlot={<AuthRoleTag>Candidate</AuthRoleTag>}
      title="Sign up as a candidate"
      subtitle="Find your next role with explainable AI matching."
      footer={
        <span>
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[var(--color-primary)] hover:underline"
          >
            Sign in
          </Link>
        </span>
      }
    >
      <RegisterCandidateForm />
    </AuthShell>
  );
}
