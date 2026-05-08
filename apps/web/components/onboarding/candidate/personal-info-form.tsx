"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Sparkles } from "lucide-react";
import { useAutosave } from "@/components/onboarding/use-autosave";
import { useTabCloseProtection } from "@/components/onboarding/use-tab-close-protection";
import { useHighlightContext } from "@/components/onboarding/resume-preview/highlight-context";
import { ButtonSpinner } from "@/components/ui/button-spinner";

export interface PersonalFormValues {
  fullName: string;
  phone: string;
  headline: string;
  summary: string;
  locationCity: string;
  locationRegion: string;
  locationCountry: string;
}

interface Props {
  defaults: PersonalFormValues;
  aiSuggestedFields: Partial<Record<keyof PersonalFormValues, boolean>>;
  accessToken: string;
  onSaveStatusChange: (status: "idle" | "saving" | "error") => void;
}

export function CandidatePersonalInfoForm({
  defaults,
  aiSuggestedFields,
  accessToken,
  onSaveStatusChange,
}: Props) {
  const router = useRouter();
  const { register, formState, getValues, setFocus } = useForm<PersonalFormValues>({
    defaultValues: defaults,
  });
  const { setHoveredFieldId, registerField } = useHighlightContext();

  // Register every named field as a focusable target so resume highlights can focus it on click.
  useEffect(() => {
    const names = Object.keys(defaults) as Array<keyof PersonalFormValues>;
    const unregisters = names.map((name) =>
      registerField(name as string, () => setFocus(name)),
    );
    return () => {
      unregisters.forEach((u) => u());
    };
  }, [registerField, setFocus, defaults]);

  const { schedule, status, retry } = useAutosave<Partial<PersonalFormValues>>({
    save: async (payload) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const res = await fetch(`${apiUrl}/api/v1/candidate-profiles/me`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
    },
  });

  useEffect(() => {
    onSaveStatusChange(status);
  }, [status, onSaveStatusChange]);

  useTabCloseProtection(formState.isDirty);

  const handleBlur = (name: keyof PersonalFormValues) => () => {
    schedule({ [name]: getValues(name) } as Partial<PersonalFormValues>);
  };

  const renderField = (
    name: keyof PersonalFormValues,
    label: string,
    type: "input" | "textarea" = "input",
    required = false,
  ) => {
    const isDirty = !!formState.dirtyFields[name];
    const wasAi = !!aiSuggestedFields[name] && !isDirty;

    return (
      <div className="flex flex-col gap-1">
        <label
          htmlFor={name}
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[var(--color-ink)]"
        >
          <span className="whitespace-nowrap">
            {label}
            {required ? (
              <span aria-hidden className="text-[var(--color-status-danger)]"> *</span>
            ) : (
              <span className="font-normal text-[var(--color-muted)]"> (Optional)</span>
            )}
          </span>
          {wasAi && (
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
              <Sparkles className="h-2.5 w-2.5" /> AI Suggested
            </span>
          )}
          {isDirty && aiSuggestedFields[name] && (
            <span className="whitespace-nowrap text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
              Edited
            </span>
          )}
        </label>
        {type === "textarea" ? (
          <textarea
            id={name}
            rows={4}
            className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            data-field-id={name}
            {...register(name, { onBlur: handleBlur(name) })}
            onFocus={() => setHoveredFieldId(name as string)}
            onBlur={() => setHoveredFieldId(null)}
          />
        ) : (
          <input
            id={name}
            className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            data-field-id={name}
            {...register(name, { onBlur: handleBlur(name) })}
            onFocus={() => setHoveredFieldId(name as string)}
            onBlur={() => setHoveredFieldId(null)}
          />
        )}
      </div>
    );
  };

  const [isContinuing, setIsContinuing] = useState(false);

  const handleContinue = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsContinuing(true);
    // Flush pending autosave then route.
    if (formState.isDirty) {
      try {
        await retry();
      } catch {
        // Autosave already surfaces its own error state via the indicator;
        // proceed to navigation regardless so the user isn't stuck.
      }
    }
    router.push("/onboarding/candidate/review");
  };

  return (
    <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {renderField("fullName", "Full Name", "input", true)}
        {renderField("phone", "Phone", "input", true)}
      </div>
      {renderField("headline", "Headline")}
      {renderField("summary", "Professional Summary", "textarea")}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {renderField("locationCity", "City")}
        {renderField("locationRegion", "Region / State")}
        {renderField("locationCountry", "Country")}
      </div>
      <div className="flex justify-between pt-3">
        <button
          type="button"
          onClick={() => router.push("/onboarding/candidate")}
          disabled={isContinuing}
          className="rounded-full bg-[var(--color-surface-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--color-ink)] disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={isContinuing}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)] disabled:cursor-not-allowed disabled:bg-[var(--color-primary-disabled)]"
        >
          {isContinuing && <ButtonSpinner />}
          {isContinuing ? "Continuing..." : "Continue"}
        </button>
      </div>
    </form>
  );
}
