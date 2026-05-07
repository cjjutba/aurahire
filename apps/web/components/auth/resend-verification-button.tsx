"use client";

import { useEffect, useState } from "react";

import { fetcher } from "@aurahire/shared";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { toastSuccess, toastApiError } from "@/lib/toast";

const COOLDOWN_SECONDS = 60;

interface ResendVerificationButtonProps {
  email: string;
}

export function ResendVerificationButton({ email }: ResendVerificationButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  async function onClick() {
    if (isSubmitting || cooldown > 0) return;
    setIsSubmitting(true);
    try {
      await fetcher("/api/v1/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      toastSuccess("Verification email sent", "Check your inbox in a moment.");
      setCooldown(COOLDOWN_SECONDS);
    } catch (err) {
      toastApiError(err, "Couldn't resend the verification email");
    } finally {
      setIsSubmitting(false);
    }
  }

  const disabled = isSubmitting || cooldown > 0;
  const label = isSubmitting
    ? "Sending..."
    : cooldown > 0
      ? `Resend in ${cooldown}s`
      : "Resend email";

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-12 w-full rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-base font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
    >
      {isSubmitting && <ButtonSpinner />}
      {label}
    </Button>
  );
}
