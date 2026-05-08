"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toastSuccess, toastApiError } from "@/lib/toast";

import { recruiterFocusSchema, type RecruiterFocus } from "@aurahire/shared";
import { useRecruiterProfilesControllerUpdateFocusV1 } from "@aurahire/shared";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const HIRING_VOLUMES = ["1-5", "6-10", "11-25", "25+"] as const;
type HiringVolume = (typeof HIRING_VOLUMES)[number];

interface FocusFormProps {
  defaults: RecruiterFocus;
}

interface FocusFormUI {
  rolesHiringForRaw: string;
  hiringVolumePerQuarter: HiringVolume | null;
}

export function RecruiterFocusForm({ defaults }: FocusFormProps) {
  const router = useRouter();

  const form = useForm<FocusFormUI>({
    defaultValues: {
      rolesHiringForRaw: (defaults.rolesHiringFor ?? []).join(", "),
      hiringVolumePerQuarter:
        (defaults.hiringVolumePerQuarter as HiringVolume | null | undefined) ??
        null,
    },
  });

  const updateFocus = useRecruiterProfilesControllerUpdateFocusV1({
    mutation: {
      onSuccess: () => {
        toastSuccess("Onboarding complete", "Welcome to AuraHire.");
        router.push("/recruiter");
        router.refresh();
      },
      onError: (err) => toastApiError(err, "Couldn't save focus areas"),
    },
  });

  async function onSubmit(values: FocusFormUI) {
    const data: RecruiterFocus = {
      rolesHiringFor: values.rolesHiringForRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      hiringVolumePerQuarter: values.hiringVolumePerQuarter,
    };
    const parsed = recruiterFocusSchema.safeParse(data);
    if (!parsed.success) {
      toastApiError(null, "Check your input", parsed.error.errors.map((e) => e.message).join(", "));
      return;
    }
    await updateFocus.mutateAsync({ data: parsed.data });
  }

  const textareaCls =
    "min-h-28 w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 py-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20";
  const labelCls = "text-sm font-semibold text-[var(--color-ink)]";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="rolesHiringForRaw"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelCls}>
                Roles you typically hire for
              </FormLabel>
              <FormControl>
                <Textarea
                  className={textareaCls}
                  rows={4}
                  placeholder="e.g. Software Engineer, Data Scientist, Product Manager"
                  {...field}
                />
              </FormControl>
              <p className="text-xs text-[var(--color-muted)]">
                Separate roles with commas.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="hiringVolumePerQuarter"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelCls}>
                Hiring volume per quarter
              </FormLabel>
              <Select
                onValueChange={(v) => field.onChange(v as HiringVolume)}
                value={field.value ?? undefined}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select hiring range" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {HIRING_VOLUMES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--color-hairline-soft)] pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/onboarding/recruiter")}
            className="h-11 rounded-[var(--radius-pill)] border-[var(--color-hairline)] bg-[var(--color-surface-strong)] px-8 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-hairline)]"
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={updateFocus.isPending}
            className="h-11 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-active)] disabled:cursor-not-allowed disabled:bg-[var(--color-primary-disabled)]"
          >
            {updateFocus.isPending && <ButtonSpinner />}
            {updateFocus.isPending ? "Finishing…" : "Complete setup"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
