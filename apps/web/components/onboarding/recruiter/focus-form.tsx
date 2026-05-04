"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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
        router.push("/recruiter");
        router.refresh();
      },
      onError: (err) =>
        toast.error("Save failed", { description: (err as Error).message }),
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
      toast.error("Validation failed", {
        description: parsed.error.errors.map((e) => e.message).join(", "),
      });
      return;
    }
    await updateFocus.mutateAsync({ data: parsed.data });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="rolesHiringForRaw"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Roles you typically hire for</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Software Engineer, Data Scientist, Product Manager"
                  {...field}
                />
              </FormControl>
              <p className="text-xs text-[var(--color-muted)]">
                Comma-separated.
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
              <FormLabel>Hiring volume per quarter</FormLabel>
              <Select
                onValueChange={(v) => field.onChange(v as HiringVolume)}
                value={field.value ?? undefined}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select range" />
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
        <div className="flex justify-between pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/onboarding/recruiter/company")}
            className="rounded-[var(--radius-pill)] px-8"
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={updateFocus.isPending}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 hover:bg-[var(--color-primary-active)]"
          >
            {updateFocus.isPending && <ButtonSpinner />}
            {updateFocus.isPending ? "Finishing..." : "Finish"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
