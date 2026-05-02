"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { z } from "zod";
import { passwordSchema, fetcher } from "@aurahire/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

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

  const form = useForm<ResetFormInput>({
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
      toast.success("Password updated. Please sign in.");
      router.push("/login");
    } catch (err) {
      const body = (err as { body?: { message?: string } }).body;
      toast.error("Reset failed", {
        description: body?.message ?? "The link may be invalid or expired.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="text-sm text-[var(--color-body)]">
        <p className="mb-2 font-semibold text-[var(--color-status-danger)]">
          Reset link is missing its token
        </p>
        <p>Request a new reset link from the forgot-password page.</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm New Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-[var(--radius-pill)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-active)]"
          size="lg"
        >
          {isSubmitting ? "Setting password..." : "Set new password"}
        </Button>
      </form>
    </Form>
  );
}
