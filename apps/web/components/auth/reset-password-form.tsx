"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { z } from "zod";
import { passwordSchema } from "@aurahire/shared";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
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

// Local schema (no token field — recovery session is in the URL fragment)
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

  const form = useForm<ResetFormInput>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    // Supabase automatically processes the recovery URL fragment on client mount.
    // We check for a session to confirm we're in a valid recovery flow.
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasRecoverySession(!!session);
    });
  }, []);

  async function onSubmit(values: ResetFormInput) {
    setIsSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) {
        toast.error("Reset failed", { description: error.message });
        return;
      }
      toast.success("Password updated. Please sign in.");
      // Sign out the recovery session so the user logs in fresh
      await supabase.auth.signOut();
      router.push("/login");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (hasRecoverySession === false) {
    return (
      <div className="text-sm text-[var(--color-body)]">
        <p className="mb-2 font-semibold text-[var(--color-status-danger)]">
          Reset link is invalid or expired
        </p>
        <p>Request a new reset link from the forgot-password page.</p>
      </div>
    );
  }

  if (hasRecoverySession === null) {
    return <div className="text-sm text-[var(--color-muted)]">Checking link...</div>;
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
