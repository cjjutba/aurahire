import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailClient } from "./verify-email-client";

export const metadata = { title: "Verifying Email" };

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthShell
          title="Verifying your email..."
          subtitle="This will only take a moment."
        />
      }
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
