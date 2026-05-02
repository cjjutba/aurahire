import { Sparkles } from "lucide-react";

interface AiSuggestedBadgeProps {
  /** When true, the field has been edited by the user. Shows "EDITED" instead. */
  edited?: boolean;
}

/**
 * Marks a field as auto-prefilled by AI (e.g., from resume parse).
 * Pairs with AiShimmer in onboarding flows where AI populates form fields.
 *
 * Usage in a form field:
 *   <FormLabel>Headline {!isFieldEdited && <AiSuggestedBadge />}</FormLabel>
 */
export function AiSuggestedBadge({ edited }: AiSuggestedBadgeProps) {
  if (edited) {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        EDITED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
      <Sparkles className="h-2.5 w-2.5" />
      AI Suggested
    </span>
  );
}
