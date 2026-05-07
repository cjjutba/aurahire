"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toastApiError } from "@/lib/toast";

import { recruiterAboutSchema, type RecruiterAbout } from "@aurahire/shared";
import { useRecruiterProfilesControllerUpdateAboutV1 } from "@aurahire/shared";
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

interface AboutFormProps {
  defaults: RecruiterAbout;
}

export function RecruiterAboutForm({ defaults }: AboutFormProps) {
  const router = useRouter();

  const form = useForm<RecruiterAbout>({
    resolver: zodResolver(recruiterAboutSchema),
    defaultValues: defaults,
  });

  const updateAbout = useRecruiterProfilesControllerUpdateAboutV1({
    mutation: {
      // Phase 4: company step is no longer in the wizard (it's resolved by
      // the create-vs-join fork at /onboarding/start), so About → Focus
      // directly.
      onSuccess: () => router.push("/onboarding/recruiter/focus"),
      onError: (err) => toastApiError(err, "Couldn't save about info"),
    },
  });

  async function onSubmit(values: RecruiterAbout) {
    await updateAbout.mutateAsync({ data: values });
  }

  const inputCls =
    "h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20";
  const labelCls = "text-sm font-semibold text-[var(--color-ink)]";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelCls}>Full Name *</FormLabel>
              <FormControl>
                <Input
                  className={inputCls}
                  placeholder="Your full name"
                  autoComplete="name"
                  {...field}
                />
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
              <FormLabel className={labelCls}>Phone *</FormLabel>
              <FormControl>
                <Input
                  className={inputCls}
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  autoComplete="tel"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="jobTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelCls}>Job Title (Optional)</FormLabel>
              <FormControl>
                <Input
                  className={inputCls}
                  placeholder="e.g. Talent Acquisition Manager"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="department"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelCls}>Department (Optional)</FormLabel>
              <FormControl>
                <Input
                  className={inputCls}
                  placeholder="e.g. Engineering, People Operations"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--color-hairline-soft)] pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/onboarding/recruiter/company-create")}
            className="h-11 rounded-[var(--radius-pill)] border-[var(--color-hairline)] bg-[var(--color-surface-strong)] px-8 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-hairline)]"
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={updateAbout.isPending}
            className="h-11 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-active)] disabled:cursor-not-allowed disabled:bg-[var(--color-primary-disabled)]"
          >
            {updateAbout.isPending && <ButtonSpinner />}
            {updateAbout.isPending ? "Saving…" : "Continue"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
