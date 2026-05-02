import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = { title: "Forgot Password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="We'll email you a link to set a new password."
      footer={
        <span>
          Remembered it?{" "}
          <Link href="/login" className="text-[var(--color-primary)] hover:underline">
            Back to sign in
          </Link>
        </span>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
