/**
 * Recruiter-side banner that explains the candidate-PII redaction
 * policy. Per thesis panel revision (May 2026): "Hide the name and
 * other personal information of the candidate except the skills."
 *
 * The banner appears at the top of every recruiter pipeline + detail
 * surface where redaction is in effect. Once an interview is completed,
 * the identity unlocks; the banner is suppressed at the call site by
 * checking `identityRevealed` on the application DTO.
 *
 * Copy is deliberately calm + thesis-defensible: "Fairness practice in
 * effect." No accusatory language. The recruiter is the audience and
 * an ally in the policy.
 */
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

interface RecruiterFairnessBannerProps {
  /**
   * Optional override - pass the same string everywhere to keep tests
   * stable across renders.
   */
  className?: string;
}

export function RecruiterFairnessBanner({
  className,
}: RecruiterFairnessBannerProps) {
  return (
    <aside
      role="note"
      aria-label="Candidate identity hidden until interview completion"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm",
        className,
      )}
    >
      <ShieldCheck
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0 text-primary"
      />
      <div>
        <p className="font-medium text-foreground">
          Fairness practice in effect
        </p>
        <p className="mt-0.5 text-muted-foreground">
          Candidate identity stays hidden until you complete an interview.
          You&apos;re seeing skills, scores, and contributions only. The
          resume becomes downloadable after the interview is marked
          completed.
        </p>
      </div>
    </aside>
  );
}
