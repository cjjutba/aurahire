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
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input type="tel" autoComplete="tel" {...field} />
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
              <FormLabel>Job Title</FormLabel>
              <FormControl>
                <Input
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
              <FormLabel>Department</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Engineering"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            disabled={updateAbout.isPending}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 hover:bg-[var(--color-primary-active)]"
          >
            {updateAbout.isPending && <ButtonSpinner />}
            {updateAbout.isPending ? "Saving..." : "Next"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
