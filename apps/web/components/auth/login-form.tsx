"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { loginSchema, type LoginInput } from "@aurahire/shared";
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

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setIsSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          toast.error("Please verify your email first", {
            description: "Check your inbox for the verification link.",
          });
        } else {
          toast.error("Sign in failed", { description: "Email or password incorrect." });
        }
        return;
      }

      if (!data.session) {
        toast.error("Sign in failed", { description: "No session created." });
        return;
      }

      // Fetch profile to determine redirect
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const profileRes = await fetch(`${apiUrl}/api/v1/profiles/me`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: "no-store",
      });

      if (profileRes.status === 404) {
        // Auth user exists but profile not initialized — orphan; rare
        toast.error("Profile not found", {
          description: "Please complete registration.",
        });
        router.push("/register");
        return;
      }

      if (!profileRes.ok) {
        toast.error("Sign in failed", { description: "Could not load profile." });
        return;
      }

      const profileBody = (await profileRes.json()) as {
        data: { role: "candidate" | "recruiter" | "admin"; profileCompleted: boolean };
      };
      const { role, profileCompleted } = profileBody.data;

      const dest =
        redirectTo ??
        (profileCompleted ? `/${role}` : `/onboarding/${role === "admin" ? "" : role}`);
      router.push(dest);
      router.refresh();
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
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <Link
                  href="/forgot-password"
                  className="text-sm text-[var(--color-primary)] hover:underline"
                >
                  Forgot?
                </Link>
              </div>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
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
          {isSubmitting ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </Form>
  );
}
