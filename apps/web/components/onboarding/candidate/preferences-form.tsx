"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  candidatePreferencesSchema,
  type CandidatePreferences,
} from "@aurahire/shared";
import {
  useCandidateProfilesControllerUpdatePreferencesV1,
  useCandidateProfilesControllerCompleteV1,
} from "@aurahire/shared";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

const SENIORITY_OPTIONS = [
  "Junior",
  "Mid",
  "Senior",
  "Lead",
  "Manager",
  "Director",
] as const;
const OPEN_TO_OPTIONS = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "on-site", label: "On-site" },
] as const;

interface Props {
  defaults: CandidatePreferences;
}

interface PreferencesFormUI {
  desiredRolesRaw: string;
  desiredSeniority: string | null;
  openTo: string[];
  desiredSalaryMin: string;
  desiredSalaryMax: string;
  desiredCurrency: string;
  availableStartDate: string;
}

export function CandidatePreferencesForm({ defaults }: Props) {
  const router = useRouter();

  const form = useForm<PreferencesFormUI>({
    defaultValues: {
      desiredRolesRaw: (defaults.desiredRoles ?? []).join(", "),
      desiredSeniority: defaults.desiredSeniority ?? null,
      openTo: defaults.openTo ?? [],
      desiredSalaryMin:
        defaults.desiredSalaryMin != null
          ? String(defaults.desiredSalaryMin)
          : "",
      desiredSalaryMax:
        defaults.desiredSalaryMax != null
          ? String(defaults.desiredSalaryMax)
          : "",
      desiredCurrency: defaults.desiredCurrency ?? "USD",
      availableStartDate: defaults.availableStartDate ?? "",
    },
  });

  const updatePreferences = useCandidateProfilesControllerUpdatePreferencesV1();
  const completeOnboarding = useCandidateProfilesControllerCompleteV1();

  const isPending =
    updatePreferences.isPending || completeOnboarding.isPending;

  async function onSubmit(values: PreferencesFormUI) {
    try {
      const data: CandidatePreferences = {
        desiredRoles: values.desiredRolesRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        desiredSeniority: values.desiredSeniority,
        openTo: values.openTo,
        desiredSalaryMin: values.desiredSalaryMin
          ? Number(values.desiredSalaryMin)
          : null,
        desiredSalaryMax: values.desiredSalaryMax
          ? Number(values.desiredSalaryMax)
          : null,
        desiredCurrency: values.desiredCurrency || "USD",
        availableStartDate: values.availableStartDate || null,
      };

      const parsed = candidatePreferencesSchema.safeParse(data);
      if (!parsed.success) {
        toast.error("Validation failed", {
          description: parsed.error.errors.map((e) => e.message).join(", "),
        });
        return;
      }

      await updatePreferences.mutateAsync({ data: parsed.data });
      await completeOnboarding.mutateAsync();
      router.push("/candidate");
      router.refresh();
    } catch (err) {
      toast.error("Failed to save preferences", {
        description: (err as Error).message,
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="desiredRolesRaw"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Desired Roles</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  placeholder="Software Engineer, Product Designer"
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
          name="desiredSeniority"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Seniority</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value ?? undefined}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select seniority" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SENIORITY_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="openTo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Open To</FormLabel>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {OPEN_TO_OPTIONS.map((opt) => {
                  const checked = field.value.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 text-sm text-[var(--color-body)]"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => {
                          if (c) field.onChange([...field.value, opt.value]);
                          else
                            field.onChange(
                              field.value.filter((v) => v !== opt.value),
                            );
                        }}
                      />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="desiredSalaryMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Salary Min</FormLabel>
                <FormControl>
                  <Input type="number" min="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="desiredSalaryMax"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Salary Max</FormLabel>
                <FormControl>
                  <Input type="number" min="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="desiredCurrency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <FormControl>
                  <Input maxLength={3} placeholder="USD" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="availableStartDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Available Start Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-between pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/onboarding/candidate/skills")}
            className="rounded-[var(--radius-pill)] px-8"
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 hover:bg-[var(--color-primary-active)]"
          >
            {isPending && <ButtonSpinner />}
            {isPending ? "Finishing..." : "Finish"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
