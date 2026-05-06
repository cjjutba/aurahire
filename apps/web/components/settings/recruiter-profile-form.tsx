"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { recruiterAboutSchema, type RecruiterAbout } from "@aurahire/shared";
import { useRecruiterProfilesControllerUpdateAboutV1 } from "@aurahire/shared";

import { toastSuccess, toastApiError } from "@/lib/toast";
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

interface Props {
  defaults: RecruiterAbout;
}

/**
 * Recruiter profile form — moved verbatim from the old single-page
 * settings client. The mutation calls the existing recruiter-profiles
 * controller; we keep that endpoint (rather than extending PATCH
 * /profiles/me) because Phase 5's Hard Rule prohibits new backend work.
 */
export function RecruiterProfileForm({ defaults }: Props) {
  const router = useRouter();

  const form = useForm<RecruiterAbout>({
    resolver: zodResolver(recruiterAboutSchema),
    defaultValues: defaults,
  });

  const updateAbout = useRecruiterProfilesControllerUpdateAboutV1({
    mutation: {
      onSuccess: () => {
        toastSuccess("Profile updated");
        router.refresh();
      },
      onError: (err) => toastApiError(err, "Couldn't update profile"),
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
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={updateAbout.isPending || !form.formState.isDirty}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 hover:bg-[var(--color-primary-active)]"
          >
            {updateAbout.isPending && <ButtonSpinner />}
            {updateAbout.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
