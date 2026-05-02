import { Sparkles } from "lucide-react";

interface AiShimmerProps {
  /** Caption shown above the shimmer; explains what AI is doing. */
  caption?: string;
  /** Height of the shimmer block in pixels. Default 160. */
  height?: number;
  className?: string;
}

/**
 * AuraHire's signature "AI is processing" affordance.
 * Always paired with a caption — silent shimmer is forbidden by design.
 *
 * Usage:
 *   <AiShimmer caption="AI is parsing your resume..." height={240} />
 */
export function AiShimmer({
  caption = "AI is processing...",
  height = 160,
  className,
}: AiShimmerProps) {
  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
        <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
        <span>{caption}</span>
      </div>
      <div
        className="overflow-hidden rounded-[var(--radius-lg)] bg-gradient-to-r from-[var(--color-surface-strong)] via-[var(--color-surface-soft)] to-[var(--color-surface-strong)] animate-shimmer"
        style={{ height: `${height}px` }}
        role="progressbar"
        aria-busy="true"
        aria-label={caption}
      />
    </div>
  );
}
