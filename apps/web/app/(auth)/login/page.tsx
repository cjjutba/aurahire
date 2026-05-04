import { Suspense } from "react";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign In" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      footer={
        <span>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-[var(--color-primary)] hover:underline">
            Sign up
          </Link>
        </span>
      }
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
