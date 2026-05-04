"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toastSuccess, toastApiError } from "@/lib/toast";

import {
  registerCandidateSchema,
  type RegisterCandidateInput,
  type SignupCandidateInput,
  fetcher,
} from "@aurahire/shared";
import { AuthInput } from "@/components/auth/auth-input";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";

export function RegisterCandidateForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterCandidateInput>({
    resolver: zodResolver(registerCandidateSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      agreedToTerms: true,
    },
  });

  async function onSubmit(values: RegisterCandidateInput) {
    setIsSubmitting(true);
    try {
      const payload: SignupCandidateInput = {
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        password: values.password,
      };

      await fetcher("/api/v1/auth/signup-candidate", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toastSuccess("Account created", "Check your email to verify.");
      router.push(`/verify-email/sent?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      const status = (err as { status?: number }).status;
      const body = (err as { body?: { code?: string; message?: string } }).body;
      if (status === 409 && body?.code === "EMAIL_ALREADY_REGISTERED") {
        setError("email", {
          message: body.message ?? "This email is already registered. Sign in instead?",
        });
      } else {
        toastApiError(err, "Couldn't create account");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <AuthInput
        id="signup-candidate-fullname"
        label="Full name"
        autoComplete="name"
        error={errors.fullName?.message}
        {...register("fullName")}
      />
      <AuthInput
        id="signup-candidate-email"
        label="Email address"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <AuthInput
        id="signup-candidate-phone"
        label="Phone (e.g. +639171234567)"
        type="tel"
        autoComplete="tel"
        error={errors.phone?.message}
        {...register("phone")}
      />
      <AuthInput
        id="signup-candidate-password"
        label="Password"
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <AuthInput
        id="signup-candidate-confirm"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <p className="px-2 pt-1 text-center text-xs leading-relaxed text-[var(--color-muted)]">
        By creating an account you agree to the AuraHire Terms and Privacy Policy.
      </p>
      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-12 w-full rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-base font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
      >
        {isSubmitting && <ButtonSpinner />}
        {isSubmitting ? "Creating account..." : "Create Account"}
      </Button>
    </form>
  );
}
