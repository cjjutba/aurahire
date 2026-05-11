"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { toastApiError, toastSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

/**
 * Local schema, kept inline because it mirrors a Supabase-Auth-only
 * concern (password updates) and is not shared with the backend.
 *
 * Supabase enforces an 8-char minimum; we mirror that. Confirmation is a
 * client-only constraint to catch typos before we hit the network.
 */
const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(72, "Maximum 72 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type PasswordChangeForm = z.infer<typeof passwordChangeSchema>;

export function SecurityPasswordForm({ email }: { email: string }) {
  const [pending, setPending] = useState(false);
  const form = useForm<PasswordChangeForm>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: PasswordChangeForm) {
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();

      // Verify the current password by attempting to sign in. Supabase
      // does not expose a "verify password" primitive, so we re-auth
      // against the same email; if the credentials are wrong we surface
      // it before issuing the update, matches the UX of every banking
      // app's "current password" field.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: values.currentPassword,
      });
      if (reauthError) {
        toastApiError(reauthError, "Current password is incorrect");
        setPending(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: values.newPassword,
      });
      if (updateError) {
        toastApiError(updateError, "Couldn't update password");
        setPending(false);
        return;
      }

      toastSuccess("Password updated");
      form.reset({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current password *</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password *</FormLabel>
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
              <FormLabel>Confirm new password *</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={pending}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 hover:bg-[var(--color-primary-active)]"
          >
            {pending && <ButtonSpinner />}
            {pending ? "Updating..." : "Update password"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
