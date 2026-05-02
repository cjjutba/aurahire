import { Check } from "lucide-react";

interface WizardStep {
  label: string;
}

interface WizardProgressProps {
  steps: WizardStep[];
  currentStep: number;
}

export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  return (
    <ol className="flex items-center justify-center gap-0">
      {steps.map((step, idx) => {
        const stepNumber = idx + 1;
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;
        const isLast = idx === steps.length - 1;

        return (
          <li key={step.label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={[
                  "flex h-6 w-6 items-center justify-center rounded-[var(--radius-full)] text-xs font-semibold transition",
                  isCompleted
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                    : isCurrent
                      ? "border-2 border-[var(--color-primary)] bg-[var(--color-canvas)] text-[var(--color-primary)]"
                      : "bg-[var(--color-hairline)] text-[var(--color-muted)]",
                ].join(" ")}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : stepNumber}
              </div>
              <span
                className={[
                  "mt-2 text-xs",
                  isCurrent
                    ? "font-semibold text-[var(--color-primary)]"
                    : "text-[var(--color-muted)]",
                ].join(" ")}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={[
                  "mx-2 h-[2px] flex-1 transition",
                  isCompleted
                    ? "bg-[var(--color-primary)]"
                    : "bg-[var(--color-hairline)]",
                ].join(" ")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
