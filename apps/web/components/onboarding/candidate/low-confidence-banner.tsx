// apps/web/components/onboarding/candidate/low-confidence-banner.tsx
import { AlertTriangle } from "lucide-react";
import type { ParsedResumeV2 } from "@/app/onboarding/candidate/_steps";

interface LowConfidenceBannerProps {
  confidence: ParsedResumeV2["parse_confidence"] | null | undefined;
}

export function LowConfidenceBanner({ confidence }: LowConfidenceBannerProps) {
  if (confidence !== "low") return null;

  return (
    <div
      role="status"
      className="mb-5 flex items-start gap-3 rounded-xl border-l-4 border-[var(--color-score-mid)] bg-[var(--color-score-mid-soft)] px-4 py-3"
    >
      <AlertTriangle
        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-score-mid)]"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--color-ink)]">
          Heads up — low-confidence parse
        </p>
        <p className="mt-0.5 text-sm text-[var(--color-body)]">
          The AI wasn&apos;t sure about parts of this resume. Double-check every prefilled field before continuing.
        </p>
      </div>
    </div>
  );
}
