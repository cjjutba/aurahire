import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface ButtonSpinnerProps {
  className?: string;
}

/**
 * Inline loading spinner for action buttons. Pair with a `disabled={working}`
 * prop on the button so the user gets both the visual + interaction signal.
 *
 * Usage:
 *   <Button disabled={working}>
 *     {working && <ButtonSpinner />}
 *     {working ? "Saving..." : "Save"}
 *   </Button>
 */
export function ButtonSpinner({ className }: ButtonSpinnerProps) {
  return (
    <Loader2
      aria-hidden="true"
      className={cn("h-4 w-4 animate-spin", className)}
    />
  );
}
