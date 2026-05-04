"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { z } from "zod";

import { passwordSchema, fetcher } from "@aurahire/shared";
import { AuthInput } from "@/components/auth/auth-input";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";

const resetFormSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetFormInput = z.infer<typeof resetFormSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormInput>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetFormInput) {
    if (!token) return;
    setIsSubmitting(true);
    try {
      await fetcher("/api/v1/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password: values.password }),
      });
      toastSuccess("Password updated", "Please sign in.");
      router.push("/login");
    } catch (err) {
      toastApiError(err, "Couldn't reset password");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center text-sm text-[var(--color-body)]">
        <p className="mb-2 font-semibold text-[var(--color-status-danger)]">
          Reset link is missing its token
        </p>
        <p>Request a new reset link from the forgot-password page.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <AuthInput
        id="reset-password"
        label="New password"
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <AuthInput
        id="reset-confirm"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-12 w-full rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-base font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
      >
        {isSubmitting && <ButtonSpinner />}
        {isSubmitting ? "Setting password..." : "Set new password"}
      </Button>
    </form>
  );
}
