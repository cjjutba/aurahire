"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { fetcher } from "@aurahire/shared";
import { AuthCard } from "@/components/auth/auth-card";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

type Status = "verifying" | "signing-in" | "success" | "error";

interface VerifyResponse {
  role: "candidate" | "recruiter";
  email: string;
  sessionTokenHash: string;
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const token = searchParams.get("token");
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot guard via ranRef
      setStatus("error");
      setErrorMessage("Verification link is missing its token.");
      return;
    }

    void (async () => {
      try {
        const result = await fetcher<VerifyResponse>("/api/v1/auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ token }),
        });

        setStatus("signing-in");

        const supabase = createSupabaseBrowserClient();
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: result.sessionTokenHash,
          type: "magiclink",
        });

        if (otpError) {
          // Email is verified at this point — fall back to manual sign-in.
          setStatus("error");
          setErrorMessage(
            "Your email is verified. Please sign in to continue.",
          );
          setTimeout(() => router.push(`/login?verified=1`), 1500);
          return;
        }

        setStatus("success");
        // Redirect to onboarding for the role. The middleware/profile flow
        // will route them to the dashboard if they're already onboarded.
        const dest = `/onboarding/${result.role}`;
        setTimeout(() => {
          router.push(dest);
          router.refresh();
        }, 600);
      } catch (err) {
        const body = (err as { body?: { message?: string } }).body;
        setStatus("error");
        setErrorMessage(
          body?.message ?? "Verification failed. The link may be invalid or expired.",
        );
      }
    })();
  }, [router, searchParams]);

  return (
    <AuthCard title="Verifying your email">
      {status === "verifying" && (
        <p className="text-sm text-[var(--color-body)]">Confirming your email...</p>
      )}
      {status === "signing-in" && (
        <p className="text-sm text-[var(--color-body)]">Signing you in...</p>
      )}
      {status === "success" && (
        <p className="text-sm text-[var(--color-status-success)]">
          ✓ Verified! Taking you to onboarding...
        </p>
      )}
      {status === "error" && (
        <div className="text-sm text-[var(--color-body)]">
          <p className="mb-2 font-semibold text-[var(--color-status-danger)]">
            {errorMessage ?? "Verification failed"}
          </p>
          <Link href="/login" className="text-[var(--color-primary)] hover:underline">
            Go to sign in →
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
