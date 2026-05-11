"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useAutosave } from "@/components/onboarding/use-autosave";
import { useTabCloseProtection } from "@/components/onboarding/use-tab-close-protection";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WORK_MODES = [
  "full-time",
  "part-time",
  "contract",
  "remote",
  "hybrid",
  "on-site",
] as const;

const WORK_MODE_LABELS: Record<(typeof WORK_MODES)[number], string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  remote: "Remote",
  hybrid: "Hybrid",
  "on-site": "On-site",
};

const SENIORITY = ["entry", "mid", "senior", "lead", "principal"] as const;

const SENIORITY_LABELS: Record<(typeof SENIORITY)[number], string> = {
  entry: "Entry",
  mid: "Mid",
  senior: "Senior",
  lead: "Lead",
  principal: "Principal",
};

export interface PreferencesFormValues {
  desiredRoles: string; // comma-separated input, split before submit
  desiredSeniority: string;
  openTo: string[];
  desiredSalaryMin: string;
  desiredSalaryMax: string;
  desiredCurrency: string;
  availableStartDate: string;
}

interface PreferencesPayload {
  desiredRoles?: string[];
  desiredSeniority?: string | null;
  openTo?: string[];
  desiredSalaryMin?: number | null;
  desiredSalaryMax?: number | null;
  desiredCurrency?: string;
  availableStartDate?: string | null;
}

interface Props {
  defaults: PreferencesFormValues;
  accessToken: string;
  onSaveStatusChange: (status: "idle" | "saving" | "error") => void;
}

export function CandidatePreferencesForm({
  defaults,
  accessToken,
  onSaveStatusChange,
}: Props) {
  const router = useRouter();
  const { register, formState, getValues, watch, setValue } =
    useForm<PreferencesFormValues>({
      defaultValues: defaults,
    });
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const buildPayload = (values: PreferencesFormValues): PreferencesPayload => ({
    desiredRoles: values.desiredRoles
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    desiredSeniority: values.desiredSeniority || null,
    openTo: values.openTo,
    desiredSalaryMin: values.desiredSalaryMin
      ? Number.parseInt(values.desiredSalaryMin, 10)
      : null,
    desiredSalaryMax: values.desiredSalaryMax
      ? Number.parseInt(values.desiredSalaryMax, 10)
      : null,
    desiredCurrency: values.desiredCurrency || "USD",
    availableStartDate: values.availableStartDate || null,
  });

  // Single source of truth for the PATCH so handleFinish can call it
  // directly (bypassing the autosave debounce / in-flight queue) and the
  // useAutosave hook can call it on blur as before.
  const savePreferences = async (
    payload: PreferencesPayload,
  ): Promise<void> => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
    const res = await fetch(`${apiUrl}/api/v1/candidate-profiles/preferences`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
  };

  const { schedule, status } = useAutosave<PreferencesPayload>({
    save: savePreferences,
  });

  useEffect(() => {
    onSaveStatusChange(status);
  }, [status, onSaveStatusChange]);

  useTabCloseProtection(formState.isDirty);

  const handleBlur = () => {
    schedule(buildPayload(getValues()));
  };

  const handleFinish = async () => {
    setFinishError(null);

    // Frontend gate that mirrors the backend `INCOMPLETE_PREFERENCES`
    // validation. Without at least one desired role there's nothing to
    // score the candidate against, block here BEFORE we navigate away,
    // instead of letting the analyzing screen call the API and surface
    // the same message later.
    const latest = buildPayload(getValues());
    if (!latest.desiredRoles || latest.desiredRoles.length === 0) {
      setFinishError("Add at least one desired role before finishing.");
      return;
    }

    setFinishing(true);
    try {
      // Bypass the autosave queue and PATCH directly. The autosave hook
      // is great for blur-driven background saves, but here we need
      // synchronous-style guarantees: a blur-triggered save can be
      // in-flight when Finish is clicked, in which case `flush()`
      // early-returns (its `inFlight` guard) and the recursive flush in
      // the `finally` block runs fire-and-forget, the await resolves
      // before the new payload actually persists, the redirect wins the
      // race, and the analyzing screen's complete-onboarding call sees
      // empty desiredRoles and 400s with INCOMPLETE_PREFERENCES. A
      // direct PATCH eliminates the race entirely.
      await savePreferences(latest);
      router.push("/onboarding/candidate/analyzing");
    } catch (err) {
      setFinishError((err as Error).message);
    } finally {
      setFinishing(false);
    }
  };

  const openTo = watch("openTo");

  const toggleWorkMode = (mode: (typeof WORK_MODES)[number]) => {
    const set = new Set(openTo);
    if (set.has(mode)) set.delete(mode);
    else set.add(mode);
    const next = Array.from(set);
    setValue("openTo", next, { shouldDirty: true });
    schedule(buildPayload({ ...getValues(), openTo: next }));
  };

  return (
    <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="desiredRoles"
          className="text-xs font-semibold text-[var(--color-ink)]"
        >
          Desired Roles{" "}
          <span
            aria-hidden="true"
            className="text-[var(--color-status-danger)]"
          >
            *
          </span>
          <span className="sr-only"> (required)</span>
        </label>
        <textarea
          id="desiredRoles"
          rows={2}
          required
          aria-required="true"
          placeholder="Software Engineer, Product Designer"
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          {...register("desiredRoles", { onBlur: handleBlur })}
        />
        <p className="text-xs text-[var(--color-muted)]">
          Comma-separated. At least one role is required.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="desiredSeniority"
          className="text-xs font-semibold text-[var(--color-ink)]"
        >
          Seniority
        </label>
        <Select
          value={watch("desiredSeniority") || undefined}
          onValueChange={(v) => {
            setValue("desiredSeniority", v ?? "", { shouldDirty: true });
            schedule(
              buildPayload({ ...getValues(), desiredSeniority: v ?? "" }),
            );
          }}
        >
          <SelectTrigger id="desiredSeniority">
            <SelectValue placeholder="Select seniority" />
          </SelectTrigger>
          <SelectContent>
            {SENIORITY.map((s) => (
              <SelectItem key={s} value={s}>
                {SENIORITY_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="text-xs font-semibold text-[var(--color-ink)]">
          Open To
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {WORK_MODES.map((mode) => (
            <label key={mode} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={openTo.includes(mode)}
                onChange={() => toggleWorkMode(mode)}
              />
              {WORK_MODE_LABELS[mode]}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="desiredSalaryMin"
            className="text-xs font-semibold text-[var(--color-ink)]"
          >
            Salary Min
          </label>
          <input
            id="desiredSalaryMin"
            type="number"
            className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none"
            {...register("desiredSalaryMin", { onBlur: handleBlur })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="desiredSalaryMax"
            className="text-xs font-semibold text-[var(--color-ink)]"
          >
            Salary Max
          </label>
          <input
            id="desiredSalaryMax"
            type="number"
            className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none"
            {...register("desiredSalaryMax", { onBlur: handleBlur })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="desiredCurrency"
            className="text-xs font-semibold text-[var(--color-ink)]"
          >
            Currency
          </label>
          <input
            id="desiredCurrency"
            placeholder="USD"
            className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none"
            {...register("desiredCurrency", { onBlur: handleBlur })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="availableStartDate"
          className="text-xs font-semibold text-[var(--color-ink)]"
        >
          Available Start Date
        </label>
        <input
          id="availableStartDate"
          type="date"
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none"
          {...register("availableStartDate", { onBlur: handleBlur })}
        />
      </div>

      {finishError && (
        <p className="text-sm text-[var(--color-status-danger)]">
          {finishError}
        </p>
      )}

      <div className="flex justify-between pt-3">
        <button
          type="button"
          onClick={() => router.push("/onboarding/candidate/review")}
          disabled={finishing}
          className="rounded-full bg-[var(--color-surface-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--color-ink)] disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleFinish}
          disabled={finishing}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)] disabled:cursor-not-allowed disabled:bg-[var(--color-primary-disabled)]"
        >
          {finishing && <ButtonSpinner />}
          {finishing ? "Finishing..." : "Finish"}
        </button>
      </div>
    </form>
  );
}
