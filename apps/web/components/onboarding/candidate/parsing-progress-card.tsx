// apps/web/components/onboarding/candidate/parsing-progress-card.tsx
"use client";

import { useEffect, useState } from "react";
import { Check, FileText, Loader2 } from "lucide-react";

interface ParsingProgressCardProps {
  file: { name: string; size: number; type: string } | null;
}

type StageId = "upload" | "extract" | "identify" | "polish";

interface Stage {
  id: StageId;
  label: string;
  duration: number;
}

const STAGES: Stage[] = [
  { id: "upload", label: "Uploading file", duration: 800 },
  { id: "extract", label: "Extracting text", duration: 3500 },
  { id: "identify", label: "Identifying experience & skills", duration: 4500 },
  { id: "polish", label: "Polishing the details", duration: Number.POSITIVE_INFINITY },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatExt(file: { name: string; type: string }): string {
  if (file.type === "application/pdf") return "PDF";
  if (
    file.type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "DOCX";
  const dot = file.name.lastIndexOf(".");
  if (dot >= 0) return file.name.slice(dot + 1).toUpperCase();
  return "FILE";
}

export function ParsingProgressCard({ file }: ParsingProgressCardProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    STAGES.slice(0, -1).forEach((stage, i) => {
      elapsed += stage.duration;
      timers.push(
        setTimeout(() => setActiveIdx((idx) => Math.max(idx, i + 1)), elapsed),
      );
    });
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  const ext = file ? formatExt(file) : "FILE";
  const sizeLabel = file ? formatBytes(file.size) : null;

  return (
    <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-strong)]">
          <FileText
            className="h-5 w-5 text-[var(--color-body)]"
            aria-hidden="true"
            strokeWidth={1.75}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate text-sm font-semibold text-[var(--color-ink)]">
              {file?.name ?? "Resume"}
            </p>
            <span className="shrink-0 rounded-full bg-[var(--color-surface-strong)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
              {ext}
            </span>
          </div>
          {sizeLabel && (
            <p className="mt-0.5 font-mono text-xs tabular-nums text-[var(--color-muted)]">
              {sizeLabel}
            </p>
          )}
        </div>
      </div>

      <div
        className="relative mt-5 h-[2px] w-full overflow-hidden rounded-full bg-[var(--color-surface-strong)]"
        role="progressbar"
        aria-label="Parsing resume"
        aria-valuetext={STAGES[activeIdx]?.label ?? "Working"}
      >
        <div className="animate-indeterminate-sweep h-full w-1/3 bg-gradient-to-r from-transparent via-[var(--color-primary)] to-transparent" />
      </div>

      <ul className="mt-5 space-y-3" role="list">
        {STAGES.map((stage, i) => {
          const state: "done" | "active" | "pending" =
            i < activeIdx ? "done" : i === activeIdx ? "active" : "pending";
          return <StageRow key={stage.id} label={stage.label} state={state} />;
        })}
      </ul>
    </div>
  );
}

function StageRow({
  label,
  state,
}: {
  label: string;
  state: "done" | "active" | "pending";
}) {
  const labelClass =
    state === "active"
      ? "flex-1 text-sm font-semibold text-[var(--color-ink)]"
      : state === "done"
        ? "flex-1 text-sm text-[var(--color-body)]"
        : "flex-1 text-sm text-[var(--color-muted-soft)]";

  return (
    <li className="flex items-center gap-3">
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center"
        aria-hidden="true"
      >
        {state === "done" ? (
          <span className="block h-2.5 w-2.5 rounded-full bg-[var(--color-score-high)]" />
        ) : state === "active" ? (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-primary)] opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]" />
          </span>
        ) : (
          <span className="block h-2.5 w-2.5 rounded-full border border-[var(--color-hairline)]" />
        )}
      </span>
      <span className={labelClass}>{label}</span>
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center"
        aria-hidden="true"
      >
        {state === "done" ? (
          <Check
            key="done"
            className="animate-stage-check-pop h-4 w-4 text-[var(--color-score-high)]"
            strokeWidth={2.5}
          />
        ) : state === "active" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-primary)]" />
        ) : (
          <span className="block h-1 w-1 rounded-full bg-[var(--color-muted-soft)]" />
        )}
      </span>
    </li>
  );
}
