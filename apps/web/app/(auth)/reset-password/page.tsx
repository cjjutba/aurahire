import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Set New Password" };

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Set a new password"
      description="Choose a strong password (at least 10 characters)."
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
