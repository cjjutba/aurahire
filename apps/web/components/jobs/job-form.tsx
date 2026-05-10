"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { toastSuccess, toastApiError } from "@/lib/toast";

import { createJobSchema, type CreateJobInput } from "@aurahire/shared";
import {
  useJobsControllerCreateV1,
  useJobsControllerUpdateV1,
} from "@aurahire/shared";

import { useInvalidate } from "@/hooks/use-invalidate-queries";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
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

import { TiptapEditor, type TiptapEditorHandle } from "./tiptap-editor";
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

type SubmitMode = "draft" | "publish";

export function JobForm({ jobId, defaults }: JobFormProps) {
  const router = useRouter();
  const isEdit = Boolean(jobId);
  const [submittingAs, setSubmittingAs] = useState<SubmitMode | null>(null);
  const isSubmitting = submittingAs !== null;

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

  const inv = useInvalidate();
  const createMutation = useJobsControllerCreateV1();
  const updateMutation = useJobsControllerUpdateV1();

  // eslint-disable-next-line react-hooks/incompatible-library -- RHF watch() drives bias-debounce; structural integration
  const descriptionPlainValue = form.watch("descriptionPlain") ?? "";
  const { flags: biasFlags, scanning: biasScanning } = useDebouncedBiasCheck(
    descriptionPlainValue,
  );

  // The Tiptap editor exposes a scrollToTerm() method via this ref so the
  // bias-flag chips can drive the editor (open the popover AND surface the
  // term in the description at the same time).
  const editorRef = useRef<TiptapEditorHandle | null>(null);

  // Pass severity-tinted flags into the editor for inline underlines. Memoize
  // to avoid the editor effect firing on every render of the form.
  const editorBiasFlags = useMemo(
    () =>
      biasFlags.map((f) => ({
        term: f.term,
        severity: f.severity,
      })),
    [biasFlags],
  );

  // Drives button visibility/emphasis. We read from biasFlags (last known
  // result) — never from biasScanning — so the buttons don't flicker while a
  // re-scan is in flight. The "Checking…" caption below conveys scan status
  // without rearranging the action area.
  //
  // Only medium/high flags gate publish. LOW flags surface in the UI and the
  // audit trail but don't block — they're informational. This mirrors the
  // backend gate in jobs.service.ts publish().
  const hasGatingFlags = biasFlags.some(
    (f) => f.severity === "medium" || f.severity === "high",
  );
  const hasOnlyLowFlags = biasFlags.length > 0 && !hasGatingFlags;
  const gatingCount = biasFlags.filter(
    (f) => f.severity === "medium" || f.severity === "high",
  ).length;

  async function handleSubmit(values: JobFormUI, mode: SubmitMode) {
    setSubmittingAs(mode);
    try {
      const payload: CreateJobInput = {
        ...values,
        requiredSkills: values.requiredSkillsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        publishImmediately: mode === "publish",
      };

      const parsed = createJobSchema.safeParse(payload);
      if (!parsed.success) {
        toastApiError(
          null,
          "Check your input",
          parsed.error.errors.map((e) => e.message).join(", "),
        );
        return;
      }

      let jobIdResult: string;
      let resultStatus: string | undefined;
      if (isEdit && jobId) {
        const res = (await updateMutation.mutateAsync({
          id: jobId,
          data: parsed.data,
        })) as unknown as { data: { id: string; status?: string } };
        jobIdResult = res.data.id;
        resultStatus = res.data.status;
        void inv.recruiterJobs();
        void inv.recruiterDashboard();
        void inv.candidateJobs();
      } else {
        const res = (await createMutation.mutateAsync({
          data: parsed.data,
        })) as unknown as { data: { id: string; status?: string } };
        jobIdResult = res.data.id;
        resultStatus = res.data.status;
        void inv.recruiterJobs();
        void inv.recruiterDashboard();
        if (mode === "publish") void inv.candidateJobs();
      }

      if (mode === "publish") {
        if (resultStatus === "published") {
          toastSuccess("Job published");
        } else {
          toastSuccess("Job created");
        }
      } else {
        toastSuccess(isEdit ? "Job updated" : "Saved as draft");
      }

      router.push(`/recruiter/jobs/${jobIdResult}`);
      router.refresh();
    } catch (err) {
      // 422 = bias-flag failure. The job was created but stayed as draft;
      // surface a warning, route to the job page where the recruiter can
      // resolve flags and republish via the existing modal flow.
      const e = err as {
        status?: number;
        body?: { code?: string; message?: string };
        jobId?: string;
      };
      if (
        mode === "publish" &&
        e?.status === 422 &&
        e?.body?.code === "BIAS_CHECK_REQUIRED"
      ) {
        toast.warning("Saved as draft — bias check required", {
          description:
            e.body?.message ??
            "Resolve the flagged language and publish from the job page.",
        });
        // Backend may not echo the new job id on 422; fall through to a
        // toast-only outcome and let the user navigate manually if needed.
        if (e.jobId) {
          router.push(`/recruiter/jobs/${e.jobId}`);
          router.refresh();
        }
      } else {
        toastApiError(err, "Couldn't save job");
      }
    } finally {
      setSubmittingAs(null);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => handleSubmit(v, "draft"))}
        className="space-y-8"
      >
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
                    ref={editorRef}
                    value={field.value}
                    placeholder="Describe the role, responsibilities, and what you're looking for…"
                    onChange={(html, plainText) => {
                      field.onChange(html);
                      form.setValue("descriptionPlain", plainText);
                    }}
                    biasFlags={editorBiasFlags}
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
              onFlagSelect={(flag) =>
                editorRef.current?.scrollToTerm(flag.term)
              }
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
                        <SelectValue placeholder="Select education level" />
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
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <div className="flex flex-col items-end gap-2 pt-4">
          {!isEdit && biasScanning && (
            <p className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-score-mid)]" />
              Checking for bias…
            </p>
          )}
          {!isEdit && hasGatingFlags && !biasScanning && (
            <p className="text-xs text-[var(--color-muted)]">
              Publishing is gated until{" "}
              {gatingCount === 1 ? "1 flag is" : `${gatingCount} flags are`}{" "}
              resolved or overridden.
            </p>
          )}
          {!isEdit && hasOnlyLowFlags && !biasScanning && (
            <p className="text-xs text-[var(--color-muted)]">
              Low-severity flags surfaced for awareness — not blocking.
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
              className="rounded-[var(--radius-pill)] px-6"
            >
              Cancel
            </Button>
            {isEdit ? (
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
              >
                {submittingAs === "draft" && <ButtonSpinner />}
                {submittingAs === "draft" ? "Saving..." : "Save changes"}
              </Button>
            ) : hasGatingFlags ? (
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
              >
                {submittingAs === "draft" && <ButtonSpinner />}
                {submittingAs === "draft" ? "Saving..." : "Save as Draft"}
              </Button>
            ) : (
              <>
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={isSubmitting}
                  className="rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-6 text-[var(--color-ink)] hover:bg-[var(--color-hairline)]"
                >
                  {submittingAs === "draft" && <ButtonSpinner />}
                  {submittingAs === "draft" ? "Saving..." : "Save as Draft"}
                </Button>
                <Button
                  type="button"
                  disabled={isSubmitting}
                  onClick={form.handleSubmit((v) => handleSubmit(v, "publish"))}
                  className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
                >
                  {submittingAs === "publish" && <ButtonSpinner />}
                  {submittingAs === "publish" ? "Creating..." : "Create Job"}
                </Button>
              </>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}
