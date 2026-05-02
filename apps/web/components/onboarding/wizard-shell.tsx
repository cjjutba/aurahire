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
  return (
    <div className="mx-auto w-full max-w-[720px] py-8">
      <div className="mb-8">
        <WizardProgress steps={steps} currentStep={currentStep} />
      </div>
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-8 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-[var(--color-body)]">{description}</p>
        )}
        <div className="mt-6">{children}</div>
      </div>
      <p className="mt-4 text-center text-xs text-[var(--color-muted)]">
        Step {currentStep} of {steps.length}
      </p>
    </div>
  );
}
