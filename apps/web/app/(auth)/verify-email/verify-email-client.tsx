"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { fetcher } from "@aurahire/shared";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { AuthShell } from "@/components/auth/auth-shell";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

type Status = "verifying" | "signing-in" | "success" | "error";

interface VerifyResponse {
  role: "candidate" | "recruiter";
  email: string;
  sessionTokenHash: string;
}

export function VerifyEmailClient() {
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
          toastSuccess("Email verified", "Please sign in to continue.");
          setStatus("success");
          setErrorMessage("Your email is verified. Please sign in to continue.");
          setTimeout(() => router.push(`/login?verified=1`), 1500);
          return;
        }

        toastSuccess("Email verified", "Redirecting to your dashboard.");
        setStatus("success");
        const dest = `/onboarding/${result.role}`;
        setTimeout(() => {
          router.push(dest);
          router.refresh();
        }, 600);
      } catch (err) {
        const body = (err as { body?: { message?: string } }).body;
        toastApiError(err, "Verification failed");
        setStatus("error");
        setErrorMessage(
          body?.message ?? "Verification failed. The link may be invalid or expired.",
        );
      }
    })();
  }, [router, searchParams]);

  if (status === "verifying" || status === "signing-in") {
    return (
      <AuthShell
        title={status === "verifying" ? "Verifying your email..." : "Signing you in..."}
        subtitle="This will only take a moment."
      >
        <div className="flex justify-center py-2">
          <Loader2 className="size-6 animate-spin text-[var(--color-primary)]" />
        </div>
      </AuthShell>
    );
  }

  if (status === "success") {
    return (
      <AuthShell title="Email verified" subtitle="Taking you to onboarding...">
        <div className="flex justify-center py-2">
          <Loader2 className="size-6 animate-spin text-[var(--color-status-success)]" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Verification failed"
      subtitle={errorMessage ?? "This link is expired or invalid."}
    >
      <Link
        href="/login"
        className="flex h-12 w-full items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-base font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-active)]"
      >
        Back to sign in
      </Link>
    </AuthShell>
  );
}
