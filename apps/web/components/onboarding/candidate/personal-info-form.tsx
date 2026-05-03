"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  candidatePersonalInfoSchema,
  type CandidatePersonalInfo,
} from "@aurahire/shared";
import { useCandidateProfilesControllerUpdatePersonalV1 } from "@aurahire/shared";
import { AiSuggestedBadge } from "@/components/ai/ai-suggested-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface Props {
  defaults: CandidatePersonalInfo;
  aiSuggestedFields?: Record<string, boolean>;
}

export function CandidatePersonalInfoForm({ defaults, aiSuggestedFields = {} }: Props) {
  const router = useRouter();

  const form = useForm<CandidatePersonalInfo>({
    resolver: zodResolver(candidatePersonalInfoSchema),
    defaultValues: defaults,
  });

  const updatePersonal = useCandidateProfilesControllerUpdatePersonalV1({
    mutation: {
      onSuccess: () => router.push("/onboarding/candidate/education"),
      onError: (err) =>
        toast.error("Save failed", { description: (err as Error).message }),
    },
  });

  async function onSubmit(values: CandidatePersonalInfo) {
    await updatePersonal.mutateAsync({ data: values });
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
              <FormLabel className="flex items-center gap-2">
                Phone
                {aiSuggestedFields.phone && <AiSuggestedBadge />}
              </FormLabel>
              <FormControl>
                <Input type="tel" autoComplete="tel" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="headline"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                Headline
                {aiSuggestedFields.headline && <AiSuggestedBadge />}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Senior Software Engineer"
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
          name="summary"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                Professional Summary
                {aiSuggestedFields.summary && <AiSuggestedBadge />}
              </FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="locationCity"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  City
                  {aiSuggestedFields.locationCity && <AiSuggestedBadge />}
                </FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="locationRegion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Region / State</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="locationCountry"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  Country
                  {aiSuggestedFields.locationCountry && <AiSuggestedBadge />}
                </FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            disabled={updatePersonal.isPending}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 hover:bg-[var(--color-primary-active)]"
          >
            {updatePersonal.isPending ? "Saving..." : "Next"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
