"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toastSuccess, toastApiError } from "@/lib/toast";

import { loginSchema, type LoginInput } from "@aurahire/shared";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { setSessionOnlyMarker } from "@/lib/auth/cookie-persistence.client";
import { setActiveCompanyId } from "@/lib/active-company";
import { AuthInput } from "@/components/auth/auth-input";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { Checkbox } from "@/components/ui/checkbox";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setIsSubmitting(true);
    try {
      // Set the persistence marker BEFORE creating the client / signing in,
      // so the cookie adapter sees it and downgrades auth cookies to session
      // cookies when "Remember me" is unchecked.
      setSessionOnlyMarker(!rememberMe);
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          toastApiError(
            null,
            "Sign in failed",
            "Please verify your email first. Check your inbox for the verification link.",
          );
        } else {
          toastApiError(null, "Sign in failed", "Email or password incorrect.");
        }
        return;
      }

      if (!data.session) {
        toastApiError(null, "Sign in failed", "No session created.");
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const profileRes = await fetch(`${apiUrl}/api/v1/profiles/me`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: "no-store",
      });

      if (profileRes.status === 404) {
        toastApiError(
          null,
          "Profile not found",
          "Please complete registration.",
        );
        router.push("/register");
        return;
      }

      if (!profileRes.ok) {
        toastApiError(null, "Sign in failed", "Could not load profile.");
        return;
      }

      const profileBody = (await profileRes.json()) as {
        data: {
          role: "candidate" | "recruiter" | "admin";
          profileCompleted: boolean;
        };
      };
      const { role, profileCompleted } = profileBody.data;

      // Clear any stale active-company id from a previous session, the
      // portal will rehydrate it from `profile.lastActiveCompanyId` on first load.
      setActiveCompanyId(null);

      const dest =
        redirectTo ??
        (profileCompleted
          ? `/${role}`
          : `/onboarding/${role === "admin" ? "" : role}`);
      toastSuccess("Signed in");
      router.push(dest);
      router.refresh();
    } catch (err) {
      toastApiError(err, "Sign in failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <AuthInput
        id="login-email"
        label="Email address"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <AuthInput
        id="login-password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <div className="flex items-center justify-between px-5 pt-1">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--color-body)] select-none">
          <Checkbox
            checked={rememberMe}
            onCheckedChange={(value) => setRememberMe(value === true)}
            aria-label="Remember me"
          />
          Remember me
        </label>
        <Link
          href="/forgot-password"
          className="text-xs text-[var(--color-primary)] hover:underline"
        >
          Forgot password?
        </Link>
      </div>
      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-12 w-full rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-base font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
      >
        {isSubmitting && <ButtonSpinner />}
        {isSubmitting ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  );
}
