"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toastSuccess, toastApiError } from "@/lib/toast";

import {
  registerRecruiterSchema,
  type RegisterRecruiterInput,
  type SignupRecruiterInput,
  fetcher,
} from "@aurahire/shared";
import { AuthInput } from "@/components/auth/auth-input";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";

export function RegisterRecruiterForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterRecruiterInput>({
    resolver: zodResolver(registerRecruiterSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      companyName: "",
      password: "",
      confirmPassword: "",
      agreedToTerms: true,
    },
  });

  async function onSubmit(values: RegisterRecruiterInput) {
    setIsSubmitting(true);
    try {
      const payload: SignupRecruiterInput = {
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        companyName: values.companyName,
        password: values.password,
      };

      await fetcher("/api/v1/auth/signup-recruiter", {
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
        id="signup-recruiter-fullname"
        label="Full name"
        autoComplete="name"
        error={errors.fullName?.message}
        {...register("fullName")}
      />
      <AuthInput
        id="signup-recruiter-company"
        label="Company name"
        autoComplete="organization"
        error={errors.companyName?.message}
        {...register("companyName")}
      />
      <AuthInput
        id="signup-recruiter-email"
        label="Work email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <AuthInput
        id="signup-recruiter-phone"
        label="Phone"
        type="tel"
        autoComplete="tel"
        error={errors.phone?.message}
        {...register("phone")}
      />
      <AuthInput
        id="signup-recruiter-password"
        label="Password"
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <AuthInput
        id="signup-recruiter-confirm"
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
