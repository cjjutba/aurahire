import type { JobStatus } from "@aurahire/shared";
import { Badge } from "@/components/ui/badge";

const STATUS_VARIANTS: Record<JobStatus, { label: string; className: string }> =
  {
    draft: {
      label: "DRAFT",
      className: "bg-[var(--color-surface-strong)] text-[var(--color-ink)]",
    },
    published: {
      label: "PUBLISHED",
      className:
        "bg-[var(--color-score-high-soft)] text-[var(--color-score-high)]",
    },
    archived: {
      label: "ARCHIVED",
      className:
        "bg-[var(--color-score-low-soft)] text-[var(--color-score-low)]",
    },
    closed: {
      label: "CLOSED",
      className: "bg-[var(--color-muted-soft)] text-[var(--color-ink)]",
    },
  };

export function JobStatusChip({ status }: { status: JobStatus }) {
  const variant = STATUS_VARIANTS[status];
  return (
    <Badge
      className={`rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold uppercase tracking-wider ${variant.className}`}
    >
      {variant.label}
    </Badge>
  );
}
