"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

type Status = "verifying" | "initializing" | "success" | "error";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    void (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        // Supabase processes the URL hash automatically on client mount.
        // After a moment, getSession returns the new session.
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          setStatus("error");
          setErrorMessage("Verification link is invalid or expired.");
          return;
        }

        const meta = (session.user.user_metadata ?? {}) as {
          role?: "candidate" | "recruiter";
          full_name?: string;
          phone?: string;
          company_name?: string;
        };

        if (!meta.role || !meta.full_name || !meta.phone) {
          setStatus("error");
          setErrorMessage("Missing registration data. Please sign up again.");
          return;
        }

        setStatus("initializing");

        // Call backend init endpoint
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
        const path =
          meta.role === "recruiter"
            ? "/api/v1/auth/register-recruiter"
            : "/api/v1/auth/register-candidate";

        const body: Record<string, unknown> = {
          fullName: meta.full_name,
          phone: meta.phone,
        };
        if (meta.role === "recruiter") {
          body.companyName = meta.company_name ?? "";
        }

        const res = await fetch(`${apiUrl}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (res.status === 409) {
          // Profile already exists — fine, just continue
        } else if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          setStatus("error");
          setErrorMessage(
            (errBody as { message?: string }).message ?? "Failed to initialize profile.",
          );
          return;
        }

        setStatus("success");
        const dest = meta.role === "recruiter" ? "/onboarding/recruiter" : "/onboarding/candidate";
        // Brief pause so user sees success state
        setTimeout(() => router.push(dest), 800);
      } catch (err) {
        setStatus("error");
        setErrorMessage((err as Error).message);
      }
    })();
  }, [router]);

  return (
    <AuthCard title="Verifying your email">
      {status === "verifying" && (
        <p className="text-sm text-[var(--color-body)]">Confirming your email...</p>
      )}
      {status === "initializing" && (
        <p className="text-sm text-[var(--color-body)]">Setting up your profile...</p>
      )}
      {status === "success" && (
        <p className="text-sm text-[var(--color-status-success)]">
          ✓ Verified! Redirecting to onboarding...
        </p>
      )}
      {status === "error" && (
        <div className="text-sm text-[var(--color-body)]">
          <p className="mb-2 font-semibold text-[var(--color-status-danger)]">
            {errorMessage ?? "Verification failed"}
          </p>
          <Link href="/register" className="text-[var(--color-primary)] hover:underline">
            Try registering again →
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
