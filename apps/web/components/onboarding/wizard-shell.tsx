import type { ReactNode } from "react";
import { WizardProgress } from "./wizard-progress";

interface WizardShellProps {
  title: string;
  description?: string;
  steps: { label: string }[];
  currentStep: number;
  children: ReactNode;
}

export function WizardShell({
  title,
  description,
  steps,
  currentStep,
  children,
}: WizardShellProps) {
  const currentLabel = steps[currentStep - 1]?.label;
  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <div className="hidden md:block">
          <WizardProgress steps={steps} currentStep={currentStep} />
        </div>
        <p className="text-center text-sm text-[var(--color-muted)] md:hidden">
          Step {currentStep} of {steps.length}
          {currentLabel && (
            <>
              :{" "}
              <strong className="text-[var(--color-ink)]">
                {currentLabel}
              </strong>
            </>
          )}
        </p>
      </div>
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 shadow-[0_4px_12px_rgba(0,0,0,0.04)] sm:p-8">
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-[var(--color-body)]">{description}</p>
        )}
        <div className="mt-6">{children}</div>
      </div>
      <p className="mt-4 hidden text-center text-xs text-[var(--color-muted)] md:block">
        Step {currentStep} of {steps.length}
      </p>
    </div>
  );
}
