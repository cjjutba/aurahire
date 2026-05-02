import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterCandidateForm } from "@/components/auth/register-candidate-form";

export const metadata = { title: "Sign Up as Candidate" };

export default function RegisterCandidatePage() {
  return (
    <AuthCard
      title="Sign up as a candidate"
      description="Find your next role with explainable AI matching."
      footer={
        <span>
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--color-primary)] hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <RegisterCandidateForm />
    </AuthCard>
  );
}
