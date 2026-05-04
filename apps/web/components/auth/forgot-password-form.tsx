"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
  fetcher,
} from "@aurahire/shared";
import { AuthInput } from "@/components/auth/auth-input";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";

export function ForgotPasswordForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setIsSubmitting(true);
    try {
      await fetcher("/api/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(values),
      }).catch(() => {});
      setSent(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center text-sm text-[var(--color-body)]">
        <p className="mb-2 font-semibold text-[var(--color-ink)]">Check your email</p>
        <p>
          If an account exists for that address, we&apos;ve sent a password reset link.
          The link expires in 1 hour.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <AuthInput
        id="forgot-email"
        label="Email address"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-12 w-full rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-base font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
      >
        {isSubmitting && <ButtonSpinner />}
        {isSubmitting ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}
