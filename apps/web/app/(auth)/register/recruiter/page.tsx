import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterRecruiterForm } from "@/components/auth/register-recruiter-form";

export const metadata = { title: "Sign Up as Recruiter" };

export default function RegisterRecruiterPage() {
  return (
    <AuthCard
      title="Sign up as a recruiter"
      description="Post jobs and find qualified candidates with bias mitigation built in."
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
    </AuthCard>
  );
}
