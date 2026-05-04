"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createJobSchema, type CreateJobInput } from "@aurahire/shared";
import {
  useJobsControllerCreateV1,
  useJobsControllerUpdateV1,
} from "@aurahire/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

import { TiptapEditor } from "./tiptap-editor";
import { useDebouncedBiasCheck } from "./_use-debounced-bias-check";
import { BiasFlagsList } from "@/components/bias/bias-flags-list";

const EMPLOYMENT_TYPES = ["full-time", "part-time", "contract"] as const;
const WORK_MODES = ["remote", "hybrid", "on-site"] as const;
const EXPERIENCE_LEVELS = [
  "entry",
  "junior",
  "mid",
  "senior",
  "lead",
  "principal",
  "manager",
  "director",
  "vp+",
] as const;
const EDUCATION_REQUIREMENTS = [
  "none",
  "high-school",
  "associate",
  "bachelor",
  "master",
  "phd",
  "other",
] as const;

interface JobFormProps {
  jobId?: string;
  defaults?: Partial<CreateJobInput>;
}

interface JobFormUI extends Omit<CreateJobInput, "requiredSkills"> {
  requiredSkillsRaw: string;
}

export function JobForm({ jobId, defaults }: JobFormProps) {
  const router = useRouter();
  const isEdit = Boolean(jobId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<JobFormUI>({
    defaultValues: {
      title: defaults?.title ?? "",
      department: defaults?.department ?? "",
      employmentType: defaults?.employmentType ?? "full-time",
      workMode: defaults?.workMode ?? "remote",
      locationCity: defaults?.locationCity ?? "",
      locationRegion: defaults?.locationRegion ?? "",
      locationCountry: defaults?.locationCountry ?? "",
      salaryMin: defaults?.salaryMin ?? null,
      salaryMax: defaults?.salaryMax ?? null,
      salaryCurrency: defaults?.salaryCurrency ?? "USD",
      description: defaults?.description ?? "",
      descriptionPlain: defaults?.descriptionPlain ?? "",
      requiredSkillsRaw: (defaults?.requiredSkills ?? []).join(", "),
      experienceLevel: defaults?.experienceLevel ?? "mid",
      educationRequirement: defaults?.educationRequirement ?? null,
      applicationDeadline: defaults?.applicationDeadline ?? null,
    },
  });

  const createMutation = useJobsControllerCreateV1();
  const updateMutation = useJobsControllerUpdateV1();

  // eslint-disable-next-line react-hooks/incompatible-library -- RHF watch() drives bias-debounce; structural integration
  const descriptionPlainValue = form.watch("descriptionPlain") ?? "";
  const { flags: biasFlags, scanning: biasScanning } =
    useDebouncedBiasCheck(descriptionPlainValue);

  async function onSubmit(values: JobFormUI) {
    setIsSubmitting(true);
    try {
      const payload: CreateJobInput = {
        ...values,
        requiredSkills: values.requiredSkillsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      const parsed = createJobSchema.safeParse(payload);
      if (!parsed.success) {
        toast.error("Validation failed", {
          description: parsed.error.errors
            .map((e) => `${e.path.join(".")}: ${e.message}`)
            .join("; "),
        });
        return;
      }

      let jobIdResult: string;
      if (isEdit && jobId) {
        const res = (await updateMutation.mutateAsync({
          id: jobId,
          data: parsed.data,
        })) as unknown as { data: { id: string } };
        jobIdResult = res.data.id;
      } else {
        const res = (await createMutation.mutateAsync({
          data: parsed.data,
        })) as unknown as { data: { id: string } };
        jobIdResult = res.data.id;
      }

      toast.success(isEdit ? "Job updated" : "Job created");
      router.push(`/recruiter/jobs/${jobIdResult}`);
      router.refresh();
    } catch (err) {
      toast.error("Save failed", { description: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Basics
          </h2>
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="e.g. Senior Software Engineer"
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
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="employmentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employment Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EMPLOYMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
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
              name="workMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Work Mode *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WORK_MODES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Location
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              control={form.control}
              name="locationCity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
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
                  <FormLabel>Region/State</FormLabel>
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
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Compensation
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="salaryMin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Salary Min</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="salaryMax"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Salary Max</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="salaryCurrency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <Input maxLength={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Description
          </h2>
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job Description *</FormLabel>
                <FormControl>
                  <TiptapEditor
                    value={field.value}
                    placeholder="Describe the role, responsibilities, and what you're looking for…"
                    onChange={(html, plainText) => {
                      field.onChange(html);
                      form.setValue("descriptionPlain", plainText);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {(biasFlags.length > 0 || biasScanning) && (
            <BiasFlagsList
              flags={biasFlags.map((f) => ({
                term: f.term,
                category: f.category,
                severity: f.severity,
                explanation: f.explanation,
                suggestion: f.suggestion,
              }))}
              scanning={biasScanning}
            />
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Requirements
          </h2>
          <FormField
            control={form.control}
            name="requiredSkillsRaw"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Required Skills</FormLabel>
                <FormControl>
                  <Textarea
                    rows={2}
                    placeholder="TypeScript, React, PostgreSQL"
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
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="experienceLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Experience Level *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EXPERIENCE_LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
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
              name="educationRequirement"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Education Requirement</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EDUCATION_REQUIREMENTS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="applicationDeadline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Application Deadline</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="rounded-[var(--radius-pill)]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 hover:bg-[var(--color-primary-active)]"
          >
            {isSubmitting ? "Saving..." : isEdit ? "Save changes" : "Save as draft"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
