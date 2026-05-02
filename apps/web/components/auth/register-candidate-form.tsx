"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { registerCandidateSchema, type RegisterCandidateInput } from "@aurahire/shared";
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

export function RegisterCandidateForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RegisterCandidateInput>({
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
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email`,
          data: {
            role: "candidate",
            full_name: values.fullName,
            phone: values.phone,
          },
        },
      });

      if (error) {
        if (error.message.toLowerCase().includes("already registered")) {
          form.setError("email", {
            message: "This email is already registered. Sign in instead?",
          });
        } else {
          toast.error("Registration failed", { description: error.message });
        }
        return;
      }

      if (!data.user) {
        toast.error("Registration failed", { description: "No user returned." });
        return;
      }

      router.push(`/verify-email/sent?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      toast.error("Unexpected error", { description: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input type="tel" autoComplete="tel" placeholder="+639171234567" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
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
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <p className="text-xs text-[var(--color-muted)]">
          By creating an account you agree to the AuraHire Terms and Privacy Policy.
        </p>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-[var(--radius-pill)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-active)]"
          size="lg"
        >
          {isSubmitting ? "Creating account..." : "Create Account"}
        </Button>
      </form>
    </Form>
  );
}
