import { Check, Loader2, AlertCircle } from "lucide-react";

export type SaveStatus = "idle" | "saving" | "error";

interface Props {
  status: SaveStatus;
  onRetry?: () => void;
  className?: string;
}

export function SaveStatusIndicator({ status, onRetry, className }: Props) {
  const cls = [
    "flex items-center gap-1.5 text-xs",
    status === "error" ? "text-[var(--color-status-danger)]" : "text-[var(--color-muted)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (status === "saving") {
    return (
      <span className={cls}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className={cls}>
        <AlertCircle className="h-3.5 w-3.5" />
        Couldn&apos;t save —{" "}
        <button onClick={onRetry} className="font-semibold underline">
          Retry
        </button>
      </span>
    );
  }
  return (
    <span className={cls}>
      <Check className="h-3.5 w-3.5" />
      All changes saved
    </span>
  );
}
