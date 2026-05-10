# Auth Redesign Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. This plan executes inline (no subagents) because the work is tightly coupled (new components consumed by every page migration).

**Goal:** Re-skin all 8 auth pages to OpenAI Platform's no-card editorial layout while preserving every existing form behavior, validation, and redirect.

**Architecture:** Five new auth-only components (`AuthShell`, `AuthInput`, `AuthFooter`, `AuthRoleTag`, `AuthRoleCard`) replace the boxed `AuthCard`. Layout swaps to top-left wordmark + dark Terms · Privacy footer. Every form keeps its Zod schema, RHF resolver, submit handler, and post-submit navigation untouched — the redesign is purely presentational.

**Tech Stack:** Next.js 16 (App Router), Tailwind v4, react-hook-form, Zod, lucide-react. CSS variables come from `apps/web/app/globals.css` `@theme` block.

**Spec:** `docs/superpowers/specs/2026-05-04-auth-redesign-design.md`

**Verification approach:** This codebase has no unit tests in `apps/web`. Verification is `pnpm type-check` + `pnpm lint` + `pnpm build` (Claude runs these), plus manual browser walk-through (the human runs `pnpm dev` per CLAUDE.md hard rules).

**Commit policy:** Per CLAUDE.md, commits happen only when the human asks. The plan does not auto-commit; commit suggestions appear at the end as a single optional step.

---

## File Structure

### Create

| Path                                          | Responsibility                                                 |
| --------------------------------------------- | -------------------------------------------------------------- |
| `apps/web/components/auth/auth-shell.tsx`     | Centered max-width wrapper + headline + optional subtitle slot |
| `apps/web/components/auth/auth-input.tsx`     | Floating-label pill input with error slot, RHF-compatible      |
| `apps/web/components/auth/auth-footer.tsx`    | Dark footer with AuraHire glyph + Terms · Privacy links        |
| `apps/web/components/auth/auth-role-tag.tsx`  | Small uppercase wayfinding chip ("Candidate" / "Recruiter")    |
| `apps/web/components/auth/auth-role-card.tsx` | Full-width pill role row with leading icon + chevron           |

### Modify

| Path                                                   | Change                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------------- |
| `apps/web/app/(auth)/layout.tsx`                       | Top-left wordmark, drop soft-grey bg, swap footer to `<AuthFooter />` |
| `apps/web/app/(auth)/login/page.tsx`                   | Replace `AuthCard` with `AuthShell`                                   |
| `apps/web/app/(auth)/register/page.tsx`                | Replace `AuthCard`, swap link cards for `<AuthRoleCard>`              |
| `apps/web/app/(auth)/register/candidate/page.tsx`      | Replace `AuthCard`, add role tag                                      |
| `apps/web/app/(auth)/register/recruiter/page.tsx`      | Replace `AuthCard`, add role tag                                      |
| `apps/web/app/(auth)/forgot-password/page.tsx`         | Replace `AuthCard`                                                    |
| `apps/web/app/(auth)/reset-password/page.tsx`          | Replace `AuthCard`                                                    |
| `apps/web/app/(auth)/verify-email/page.tsx`            | Replace `AuthCard`                                                    |
| `apps/web/app/(auth)/verify-email/sent/page.tsx`       | Replace `AuthCard`                                                    |
| `apps/web/components/auth/login-form.tsx`              | Swap shadcn `<Input>`/`<Form*>` for `<AuthInput>`                     |
| `apps/web/components/auth/register-candidate-form.tsx` | Same as login-form                                                    |
| `apps/web/components/auth/register-recruiter-form.tsx` | Same as login-form                                                    |
| `apps/web/components/auth/forgot-password-form.tsx`    | Same as login-form                                                    |
| `apps/web/components/auth/reset-password-form.tsx`     | Same as login-form                                                    |

### Delete

| Path                                     | Why                                                                |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `apps/web/components/auth/auth-card.tsx` | Superseded by `<AuthShell>`. Delete after every consumer migrates. |

---

## Task 1: New auth components

**Goal:** Author all five new components in isolation. They have no consumers yet, so verification is just `tsc --noEmit` (type-check) — they cannot break anything.

**Files:**

- Create: `apps/web/components/auth/auth-shell.tsx`
- Create: `apps/web/components/auth/auth-input.tsx`
- Create: `apps/web/components/auth/auth-footer.tsx`
- Create: `apps/web/components/auth/auth-role-tag.tsx`
- Create: `apps/web/components/auth/auth-role-card.tsx`

- [ ] **Step 1.1: Create `auth-footer.tsx`**

```tsx
import Link from "next/link";

export function AuthFooter() {
  return (
    <footer className="bg-[var(--color-surface-dark)] px-6 py-5 sm:px-8">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2.5 text-[var(--color-on-dark-soft)]">
          <span
            aria-hidden
            className="inline-block size-[18px] rounded-[4px] bg-[var(--color-primary)]"
          />
          <span className="font-medium text-[var(--color-on-dark)]">
            AuraHire
          </span>
        </div>
        <nav className="flex items-center gap-5 text-[var(--color-on-dark-soft)]">
          <Link
            href="/legal/terms"
            className="hover:text-[var(--color-on-dark)] hover:underline"
          >
            Terms of Use
          </Link>
          <span aria-hidden>|</span>
          <Link
            href="/legal/privacy"
            className="hover:text-[var(--color-on-dark)] hover:underline"
          >
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
```

- [ ] **Step 1.2: Create `auth-shell.tsx`**

```tsx
import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  subtitle?: ReactNode;
  /** Renders above the title, used for "Candidate" / "Recruiter" wayfinding chip */
  topSlot?: ReactNode;
  children: ReactNode;
  /** Renders below the form (e.g. "Don't have an account? Sign up") */
  footer?: ReactNode;
}

export function AuthShell({
  title,
  subtitle,
  topSlot,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="mx-auto w-full max-w-[360px] sm:max-w-[400px]">
      {topSlot && <div className="mb-4 flex justify-center">{topSlot}</div>}
      <h1 className="mb-2 text-center font-[var(--font-display)] text-[28px] font-normal tracking-[-0.5px] text-[var(--color-ink)] sm:text-[30px]">
        {title}
      </h1>
      {subtitle && (
        <p className="mx-auto mb-8 max-w-[320px] text-center text-sm leading-relaxed text-[var(--color-body)]">
          {subtitle}
        </p>
      )}
      {!subtitle && <div className="mb-8" />}
      {children}
      {footer && (
        <div className="mt-6 text-center text-sm text-[var(--color-body)]">
          {footer}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 1.3: Create `auth-input.tsx` (floating-label pill, RHF-compatible)**

The `placeholder=" "` (single space) is essential — the `:placeholder-shown` CSS selector needs a non-empty placeholder to detect "input is empty." The label uses Tailwind `peer` utilities to float when the input is focused or filled.

```tsx
"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface AuthInputProps extends Omit<
  React.ComponentProps<"input">,
  "placeholder"
> {
  id: string;
  label: string;
  error?: string;
}

export const AuthInput = React.forwardRef<HTMLInputElement, AuthInputProps>(
  function AuthInput(
    { id, label, error, className, type = "text", ...rest },
    ref,
  ) {
    const errorId = error ? `${id}-error` : undefined;
    return (
      <div className="w-full">
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={type}
            placeholder=" "
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            className={cn(
              "peer h-[52px] w-full rounded-[var(--radius-pill)] border px-5 pt-1.5 text-[15px] text-[var(--color-ink)] outline-none transition-colors",
              "border-[var(--color-hairline)] bg-[var(--color-canvas)]",
              "placeholder:text-[var(--color-muted-soft)]",
              "focus:border-[2px] focus:border-[var(--color-primary)] focus:px-[19px] focus:pt-1.5",
              error &&
                "border-[2px] border-[var(--color-status-danger)] px-[19px] focus:border-[var(--color-status-danger)]",
              "disabled:cursor-not-allowed disabled:opacity-60",
              className,
            )}
            {...rest}
          />
          <label
            htmlFor={id}
            className={cn(
              "pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 bg-[var(--color-canvas)] px-1.5 text-[15px] text-[var(--color-muted-soft)] transition-all duration-150",
              "peer-focus:top-0 peer-focus:text-[11px] peer-focus:font-medium peer-focus:text-[var(--color-body)]",
              "peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-medium peer-[:not(:placeholder-shown)]:text-[var(--color-body)]",
              error &&
                "peer-focus:text-[var(--color-status-danger)] peer-[:not(:placeholder-shown)]:text-[var(--color-status-danger)]",
            )}
          >
            {label}
          </label>
        </div>
        {error && (
          <p
            id={errorId}
            className="mt-1.5 px-5 text-xs text-[var(--color-status-danger)]"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);
```

- [ ] **Step 1.4: Create `auth-role-tag.tsx`**

```tsx
interface AuthRoleTagProps {
  children: React.ReactNode;
}

export function AuthRoleTag({ children }: AuthRoleTagProps) {
  return (
    <span className="inline-block rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-body)]">
      {children}
    </span>
  );
}
```

- [ ] **Step 1.5: Create `auth-role-card.tsx`**

```tsx
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

interface AuthRoleCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

export function AuthRoleCard({
  href,
  icon: Icon,
  title,
  description,
}: AuthRoleCardProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-6 py-4 transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/30"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-surface-strong)] text-[var(--color-body)] group-hover:bg-[var(--color-canvas)] group-hover:text-[var(--color-primary)]">
        <Icon className="size-4" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-[var(--color-ink)]">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-[var(--color-body)]">
          {description}
        </span>
      </span>
      <ChevronRight className="size-4 text-[var(--color-muted)]" />
    </Link>
  );
}
```

- [ ] **Step 1.6: Type-check**

Run: `pnpm --filter @aurahire/web type-check`
Expected: passes (no TS errors)

- [ ] **Step 1.7: Lint**

Run: `pnpm --filter @aurahire/web lint`
Expected: passes (no ESLint errors)

---

## Task 2: Update `(auth)/layout.tsx`

**Goal:** Top-left wordmark with hairline-soft bottom border. White canvas (drop the `surface-soft` background). Swap footer to `<AuthFooter />`.

**Files:**

- Modify: `apps/web/app/(auth)/layout.tsx`

- [ ] **Step 2.1: Rewrite the layout**

Replace the entire file with:

```tsx
import Link from "next/link";

import { AuthFooter } from "@/components/auth/auth-footer";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)]">
      <header className="border-b border-[var(--color-hairline-soft)] px-6 py-5 sm:px-8 sm:py-6">
        <Link
          href="/"
          className="text-[18px] font-semibold tracking-tight text-[var(--color-ink)]"
        >
          AuraHire
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-20">
        {children}
      </main>
      <AuthFooter />
    </div>
  );
}
```

- [ ] **Step 2.2: Type-check**

Run: `pnpm --filter @aurahire/web type-check`
Expected: passes.

---

## Task 3: Migrate `/login`

**Goal:** Smallest 2-field migration. Establishes the page-level pattern (`<AuthShell>` + redesigned form) that the next 7 migrations follow.

**Files:**

- Modify: `apps/web/app/(auth)/login/page.tsx`
- Modify: `apps/web/components/auth/login-form.tsx`

- [ ] **Step 3.1: Rewrite `login/page.tsx`**

Replace the entire file with:

```tsx
import { Suspense } from "react";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign In" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      footer={
        <span>
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-[var(--color-primary)] hover:underline"
          >
            Sign up
          </Link>
        </span>
      }
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
```

- [ ] **Step 3.2: Rewrite `login-form.tsx`**

Replace the entire file with:

```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { loginSchema, type LoginInput } from "@aurahire/shared";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { AuthInput } from "@/components/auth/auth-input";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          toast.error("Sign in failed", {
            description: "Email or password incorrect.",
          });
        }
        return;
      }

      if (!data.session) {
        toast.error("Sign in failed", { description: "No session created." });
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const profileRes = await fetch(`${apiUrl}/api/v1/profiles/me`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: "no-store",
      });

      if (profileRes.status === 404) {
        toast.error("Profile not found", {
          description: "Please complete registration.",
        });
        router.push("/register");
        return;
      }

      if (!profileRes.ok) {
        toast.error("Sign in failed", {
          description: "Could not load profile.",
        });
        return;
      }

      const profileBody = (await profileRes.json()) as {
        data: {
          role: "candidate" | "recruiter" | "admin";
          profileCompleted: boolean;
        };
      };
      const { role, profileCompleted } = profileBody.data;

      const dest =
        redirectTo ??
        (profileCompleted
          ? `/${role}`
          : `/onboarding/${role === "admin" ? "" : role}`);
      router.push(dest);
      router.refresh();
    } catch (err) {
      toast.error("Unexpected error", { description: (err as Error).message });
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
      <div className="-mt-1 px-5 text-left">
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
        {isSubmitting ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3.3: Type-check**

Run: `pnpm --filter @aurahire/web type-check`
Expected: passes.

---

## Task 4: Migrate `/register` (role select)

**Files:**

- Modify: `apps/web/app/(auth)/register/page.tsx`

- [ ] **Step 4.1: Rewrite `register/page.tsx`**

```tsx
import Link from "next/link";
import { Briefcase, User } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { AuthRoleCard } from "@/components/auth/auth-role-card";

export const metadata = { title: "Create Account" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Choose your role to get started."
      footer={
        <span>
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[var(--color-primary)] hover:underline"
          >
            Sign in
          </Link>
        </span>
      }
    >
      <div className="space-y-3">
        <AuthRoleCard
          href="/register/candidate"
          icon={User}
          title="I'm a Candidate"
          description="Looking for jobs and tracking applications."
        />
        <AuthRoleCard
          href="/register/recruiter"
          icon={Briefcase}
          title="I'm a Recruiter"
          description="Posting jobs and reviewing candidates."
        />
      </div>
    </AuthShell>
  );
}
```

- [ ] **Step 4.2: Type-check**

Run: `pnpm --filter @aurahire/web type-check`
Expected: passes.

---

## Task 5: Migrate `/register/candidate`

**Files:**

- Modify: `apps/web/app/(auth)/register/candidate/page.tsx`
- Modify: `apps/web/components/auth/register-candidate-form.tsx`

- [ ] **Step 5.1: Rewrite `register/candidate/page.tsx`**

```tsx
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { AuthRoleTag } from "@/components/auth/auth-role-tag";
import { RegisterCandidateForm } from "@/components/auth/register-candidate-form";

export const metadata = { title: "Sign Up as Candidate" };

export default function RegisterCandidatePage() {
  return (
    <AuthShell
      topSlot={<AuthRoleTag>Candidate</AuthRoleTag>}
      title="Sign up as a candidate"
      subtitle="Find your next role with explainable AI matching."
      footer={
        <span>
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[var(--color-primary)] hover:underline"
          >
            Sign in
          </Link>
        </span>
      }
    >
      <RegisterCandidateForm />
    </AuthShell>
  );
}
```

- [ ] **Step 5.2: Rewrite `register-candidate-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  registerCandidateSchema,
  type RegisterCandidateInput,
  type SignupCandidateInput,
  fetcher,
} from "@aurahire/shared";
import { AuthInput } from "@/components/auth/auth-input";
import { Button } from "@/components/ui/button";

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

      router.push(
        `/verify-email/sent?email=${encodeURIComponent(values.email)}`,
      );
    } catch (err) {
      const status = (err as { status?: number }).status;
      const body = (err as { body?: { code?: string; message?: string } }).body;
      if (status === 409 && body?.code === "EMAIL_ALREADY_REGISTERED") {
        setError("email", {
          message:
            body.message ??
            "This email is already registered. Sign in instead?",
        });
      } else {
        toast.error("Registration failed", {
          description: body?.message ?? (err as Error).message,
        });
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
        By creating an account you agree to the AuraHire Terms and Privacy
        Policy.
      </p>
      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-12 w-full rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-base font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
      >
        {isSubmitting ? "Creating account..." : "Create Account"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5.3: Type-check**

Run: `pnpm --filter @aurahire/web type-check`
Expected: passes.

---

## Task 6: Migrate `/register/recruiter`

**Files:**

- Modify: `apps/web/app/(auth)/register/recruiter/page.tsx`
- Modify: `apps/web/components/auth/register-recruiter-form.tsx`

- [ ] **Step 6.1: Rewrite `register/recruiter/page.tsx`**

```tsx
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { AuthRoleTag } from "@/components/auth/auth-role-tag";
import { RegisterRecruiterForm } from "@/components/auth/register-recruiter-form";

export const metadata = { title: "Sign Up as Recruiter" };

export default function RegisterRecruiterPage() {
  return (
    <AuthShell
      topSlot={<AuthRoleTag>Recruiter</AuthRoleTag>}
      title="Sign up as a recruiter"
      subtitle="Post jobs and find qualified candidates with bias mitigation built in."
      footer={
        <span>
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[var(--color-primary)] hover:underline"
          >
            Sign in
          </Link>
        </span>
      }
    >
      <RegisterRecruiterForm />
    </AuthShell>
  );
}
```

- [ ] **Step 6.2: Rewrite `register-recruiter-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  registerRecruiterSchema,
  type RegisterRecruiterInput,
  type SignupRecruiterInput,
  fetcher,
} from "@aurahire/shared";
import { AuthInput } from "@/components/auth/auth-input";
import { Button } from "@/components/ui/button";

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

      router.push(
        `/verify-email/sent?email=${encodeURIComponent(values.email)}`,
      );
    } catch (err) {
      const status = (err as { status?: number }).status;
      const body = (err as { body?: { code?: string; message?: string } }).body;
      if (status === 409 && body?.code === "EMAIL_ALREADY_REGISTERED") {
        setError("email", {
          message:
            body.message ??
            "This email is already registered. Sign in instead?",
        });
      } else {
        toast.error("Registration failed", {
          description: body?.message ?? (err as Error).message,
        });
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
        By creating an account you agree to the AuraHire Terms and Privacy
        Policy.
      </p>
      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-12 w-full rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-base font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
      >
        {isSubmitting ? "Creating account..." : "Create Account"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 6.3: Type-check**

Run: `pnpm --filter @aurahire/web type-check`
Expected: passes.

---

## Task 7: Migrate `/forgot-password`

**Files:**

- Modify: `apps/web/app/(auth)/forgot-password/page.tsx`
- Modify: `apps/web/components/auth/forgot-password-form.tsx`

- [ ] **Step 7.1: Rewrite `forgot-password/page.tsx`**

```tsx
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = { title: "Forgot Password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot password"
      subtitle="Enter your email and we'll send a reset link."
      footer={
        <span>
          Remember it?{" "}
          <Link
            href="/login"
            className="text-[var(--color-primary)] hover:underline"
          >
            Sign in
          </Link>
        </span>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
```

- [ ] **Step 7.2: Rewrite `forgot-password-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
  fetcher,
} from "@aurahire/shared";
import { AuthInput } from "@/components/auth/auth-input";
import { Button } from "@/components/ui/button";

export function ForgotPasswordForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setIsSubmitting(true);
    try {
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
      <div className="text-center text-sm text-[var(--color-body)]">
        <p className="mb-2 font-semibold text-[var(--color-ink)]">
          Check your email
        </p>
        <p>
          If an account exists for that address, we&apos;ve sent a password
          reset link. The link expires in 1 hour.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <AuthInput
        id="forgot-email"
        label="Email address"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-12 w-full rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-base font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
      >
        {isSubmitting ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 7.3: Type-check**

Run: `pnpm --filter @aurahire/web type-check`
Expected: passes.

---

## Task 8: Migrate `/reset-password`

**Files:**

- Modify: `apps/web/app/(auth)/reset-password/page.tsx`
- Modify: `apps/web/components/auth/reset-password-form.tsx`

- [ ] **Step 8.1: Rewrite `reset-password/page.tsx`**

```tsx
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Set New Password" };

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a strong password (at least 10 characters)."
    >
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
```

- [ ] **Step 8.2: Rewrite `reset-password-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { passwordSchema, fetcher } from "@aurahire/shared";
import { AuthInput } from "@/components/auth/auth-input";
import { Button } from "@/components/ui/button";

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
        {isSubmitting ? "Setting password..." : "Set new password"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 8.3: Type-check**

Run: `pnpm --filter @aurahire/web type-check`
Expected: passes.

---

## Task 9: Migrate `/verify-email` (token landing page)

**Files:**

- Modify: `apps/web/app/(auth)/verify-email/page.tsx`

This page is a `"use client"` page (not a separate form component). Replace `<AuthCard>` with `<AuthShell>` and adjust copy per spec to handle 4 states: verifying / signing-in / success / error.

- [ ] **Step 9.1: Rewrite `verify-email/page.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { fetcher } from "@aurahire/shared";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

type Status = "verifying" | "signing-in" | "success" | "error";

interface VerifyResponse {
  role: "candidate" | "recruiter";
  email: string;
  sessionTokenHash: string;
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const token = searchParams.get("token");
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot guard via ranRef
      setStatus("error");
      setErrorMessage("Verification link is missing its token.");
      return;
    }

    void (async () => {
      try {
        const result = await fetcher<VerifyResponse>(
          "/api/v1/auth/verify-email",
          {
            method: "POST",
            body: JSON.stringify({ token }),
          },
        );

        setStatus("signing-in");

        const supabase = createSupabaseBrowserClient();
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: result.sessionTokenHash,
          type: "magiclink",
        });

        if (otpError) {
          setStatus("error");
          setErrorMessage(
            "Your email is verified. Please sign in to continue.",
          );
          setTimeout(() => router.push(`/login?verified=1`), 1500);
          return;
        }

        setStatus("success");
        const dest = `/onboarding/${result.role}`;
        setTimeout(() => {
          router.push(dest);
          router.refresh();
        }, 600);
      } catch (err) {
        const body = (err as { body?: { message?: string } }).body;
        setStatus("error");
        setErrorMessage(
          body?.message ??
            "Verification failed. The link may be invalid or expired.",
        );
      }
    })();
  }, [router, searchParams]);

  if (status === "verifying" || status === "signing-in") {
    return (
      <AuthShell
        title={
          status === "verifying"
            ? "Verifying your email..."
            : "Signing you in..."
        }
        subtitle="This will only take a moment."
      >
        <div className="flex justify-center py-2">
          <Loader2 className="size-6 animate-spin text-[var(--color-primary)]" />
        </div>
      </AuthShell>
    );
  }

  if (status === "success") {
    return (
      <AuthShell title="Email verified" subtitle="Taking you to onboarding...">
        <div className="flex justify-center py-2">
          <Loader2 className="size-6 animate-spin text-[var(--color-status-success)]" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Verification failed"
      subtitle={errorMessage ?? "This link is expired or invalid."}
    >
      <Button
        asChild
        className="h-12 w-full rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-base font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
      >
        <Link href="/login">Back to sign in</Link>
      </Button>
    </AuthShell>
  );
}
```

- [ ] **Step 9.2: Type-check**

Run: `pnpm --filter @aurahire/web type-check`
Expected: passes.

---

## Task 10: Migrate `/verify-email/sent`

**Files:**

- Modify: `apps/web/app/(auth)/verify-email/sent/page.tsx`

- [ ] **Step 10.1: Rewrite `verify-email/sent/page.tsx`**

```tsx
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Check Your Inbox" };

interface PageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function VerifyEmailSentPage({ searchParams }: PageProps) {
  const { email } = await searchParams;

  return (
    <AuthShell
      title="Check your inbox"
      subtitle={
        <>
          We&apos;ve sent a verification link to{" "}
          <span className="font-semibold text-[var(--color-ink)]">
            {email ?? "your inbox"}
          </span>
          .
        </>
      }
    >
      <p className="mx-auto mb-8 max-w-[320px] text-center text-sm leading-relaxed text-[var(--color-body)]">
        Click the link in the email to activate your account. The link expires
        in 24 hours. Don&apos;t see it? Check your spam folder.
      </p>
      <Button
        asChild
        className="h-12 w-full rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-base font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
      >
        <Link href="/login">Back to sign in</Link>
      </Button>
    </AuthShell>
  );
}
```

- [ ] **Step 10.2: Type-check**

Run: `pnpm --filter @aurahire/web type-check`
Expected: passes.

---

## Task 11: Delete `AuthCard` + final verification

**Files:**

- Delete: `apps/web/components/auth/auth-card.tsx`

- [ ] **Step 11.1: Confirm no remaining consumers**

Run: search for any remaining import of `auth-card` across the web app.
Expected: zero matches (besides the file itself).

- [ ] **Step 11.2: Delete the file**

```bash
rm apps/web/components/auth/auth-card.tsx
```

- [ ] **Step 11.3: Final type-check**

Run: `pnpm --filter @aurahire/web type-check`
Expected: passes (no broken imports).

- [ ] **Step 11.4: Final lint**

Run: `pnpm --filter @aurahire/web lint`
Expected: passes.

- [ ] **Step 11.5: Final build**

Run: `pnpm --filter @aurahire/web build`
Expected: build succeeds end-to-end. This is the strongest non-runtime verification — Next.js compiles every page, validates server-component vs client-component boundaries, and surfaces any module errors.

---

## Manual verification (human runs)

Per CLAUDE.md, Claude does not run dev servers. After Task 11 passes, the human runs:

```bash
pnpm dev
```

…then opens the following URLs and verifies:

- [ ] `http://localhost:3000/login` — wordmark top-left, white canvas, two pill inputs with floating labels, "Forgot password?" link below password, blue "Sign In" pill, dark Terms · Privacy footer.
- [ ] `http://localhost:3000/register` — two stacked pill role cards with leading icons + chevrons.
- [ ] `http://localhost:3000/register/candidate` — "CANDIDATE" tag above H1, 5 pill inputs, terms blurb, "Create Account".
- [ ] `http://localhost:3000/register/recruiter` — "RECRUITER" tag, 6 pill inputs, "Create Account".
- [ ] `http://localhost:3000/forgot-password` — single email input + "Send reset link". Submit shows "Check your email" message inline.
- [ ] `http://localhost:3000/reset-password?token=test` — two password pill inputs + "Set new password". Without token: shows "missing token" error.
- [ ] `http://localhost:3000/verify-email` (no token) — shows "Verification failed" + "Back to sign in" CTA.
- [ ] `http://localhost:3000/verify-email/sent?email=test@x.com` — bolded email in subtitle, body copy, "Back to sign in" CTA.
- [ ] Floating labels animate on focus and stay floated when filled.
- [ ] Error states: submit empty form → red 2px border + red error text below input.
- [ ] Tab order is sane on every page.
- [ ] Mobile (375px) and desktop (1280px) widths look right.

---

## Optional: commit (human triggers)

After manual verification passes, the human asks Claude to commit. Suggested commit body:

```
feat(auth): redesign auth pages to OpenAI Platform-style no-card layout

- New components: AuthShell, AuthInput (floating-label pill), AuthFooter,
  AuthRoleTag, AuthRoleCard
- Updated (auth) layout: top-left wordmark, white canvas, dark Terms·Privacy
  footer
- Migrated all 8 auth pages: login, register (role-select), candidate signup,
  recruiter signup, forgot-password, reset-password, verify-email,
  verify-email/sent
- All form behaviors preserved (Zod schemas, RHF resolvers, redirects)
- Removed: AuthCard (superseded by AuthShell)

Spec: docs/superpowers/specs/2026-05-04-auth-redesign-design.md
Plan: docs/superpowers/plans/2026-05-04-auth-redesign.md
```

---

## Self-review (done before plan was saved)

- ✅ **Spec coverage:** every section of the design spec maps to a task. Layout chrome → Task 2; floating-label pill → Task 1.3; per-page specs → Tasks 3–10; AuthCard removal → Task 11.
- ✅ **No placeholders:** every step contains complete code or an exact command.
- ✅ **Type consistency:** `AuthShell` props (`title`, `subtitle`, `topSlot`, `children`, `footer`) are referenced consistently across Tasks 3–10. `AuthInput` props (`id`, `label`, `error`, plus standard input props) match between Task 1.3 (definition) and Tasks 3, 5, 6, 7, 8 (consumers).
- ✅ **Verification reality:** uses commands Claude is permitted to run (type-check, lint, build); flags manual browser check as human's job per CLAUDE.md.
