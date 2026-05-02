"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
  fetcher,
} from "@aurahire/shared";
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

export function ForgotPasswordForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setIsSubmitting(true);
    try {
      // Always treat as success; the API never discloses whether the email exists.
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
      <div className="text-sm text-[var(--color-body)]">
        <p className="mb-2 font-semibold text-[var(--color-ink)]">Check your email</p>
        <p>
          If an account exists for that address, we've sent a password reset link. The link
          expires in 1 hour.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
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
          {isSubmitting ? "Sending..." : "Send reset link"}
        </Button>
      </form>
    </Form>
  );
}
