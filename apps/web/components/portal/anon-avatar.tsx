/**
 * Anonymized candidate avatar — rendered in recruiter pipeline lists
 * before interview completion. Per thesis panel revision (May 2026)
 * candidate identity is hidden from recruiters until an interview is
 * completed; the avatar must not leak initials of the real name. This
 * component renders a neutral skill-glyph instead.
 *
 * Usage:
 *   <AnonAvatar size="sm" />     // 32px circle
 *   <AnonAvatar size="md" />     // 40px circle (pipeline default)
 *
 * Pair with `<RecruiterFairnessBanner />` on parent pages to explain
 * the hidden-PII policy to the recruiter.
 */
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

interface AnonAvatarProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AnonAvatarProps["size"]>, string> = {
  sm: "size-8 text-[14px]",
  md: "size-10 text-[16px]",
  lg: "size-12 text-[18px]",
};

export function AnonAvatar({ size = "md", className }: AnonAvatarProps) {
  return (
    <div
      role="img"
      aria-label="Candidate (identity hidden until interview is completed)"
      className={cn(
        "flex items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border",
        SIZE_CLASSES[size],
        className,
      )}
    >
      <Sparkles
        aria-hidden="true"
        className={cn(
          size === "sm" ? "size-4" : size === "lg" ? "size-6" : "size-5",
        )}
      />
    </div>
  );
}
