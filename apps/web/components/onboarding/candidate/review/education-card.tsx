"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

export interface EducationEntry {
  id: string;
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  start_year: number | null;
  end_year: number | null;
  gpa: string | null;
}

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number";
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-[var(--color-ink)]">
        {label}
        {required && (
          <span aria-hidden className="text-[var(--color-status-danger)]"> *</span>
        )}
      </label>
      <input
        type={type}
        className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

interface Props {
  entry: EducationEntry;
  defaultExpanded?: boolean;
  onSave: (updated: EducationEntry) => Promise<void> | void;
  onDelete: () => void;
}

export function EducationCard({ entry, defaultExpanded = false, onSave, onDelete }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [draft, setDraft] = useState<EducationEntry>(entry);

  if (!expanded) {
    return (
      <div
        className="group cursor-pointer rounded-xl border border-[var(--color-hairline)] p-4 transition hover:border-[var(--color-primary-soft)]"
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[var(--color-ink)]">
              {entry.institution || "Untitled school"}
            </div>
            <div className="text-xs text-[var(--color-muted)]">
              {[entry.degree, entry.field_of_study].filter(Boolean).join(" · ") || "—"}
            </div>
            <div className="font-mono text-xs text-[var(--color-muted)]">
              {entry.start_year ?? "?"} – {entry.end_year ?? "?"}
              {entry.gpa ? ` · GPA ${entry.gpa}` : ""}
            </div>
          </div>
          <div className="flex gap-2 opacity-0 transition group-hover:opacity-100">
            <button aria-label="Edit" className="text-[var(--color-muted)]">
              <Pencil className="h-4 w-4" />
            </button>
            <button
              aria-label="Delete"
              className="text-[var(--color-muted)] hover:text-[var(--color-status-danger)]"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-[var(--color-primary)] bg-[var(--color-canvas)] p-5 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldInput
          label="Institution"
          required
          value={draft.institution}
          onChange={(v) => setDraft({ ...draft, institution: v })}
        />
        <FieldInput
          label="Degree"
          value={draft.degree ?? ""}
          onChange={(v) => setDraft({ ...draft, degree: v || null })}
        />
        <FieldInput
          label="Field of study"
          value={draft.field_of_study ?? ""}
          onChange={(v) => setDraft({ ...draft, field_of_study: v || null })}
        />
        <FieldInput
          label="GPA"
          value={draft.gpa ?? ""}
          placeholder="3.7"
          onChange={(v) => setDraft({ ...draft, gpa: v || null })}
        />
        <FieldInput
          label="Start year"
          value={draft.start_year?.toString() ?? ""}
          type="number"
          onChange={(v) =>
            setDraft({ ...draft, start_year: v ? Number.parseInt(v, 10) : null })
          }
        />
        <FieldInput
          label="End year"
          value={draft.end_year?.toString() ?? ""}
          type="number"
          onChange={(v) =>
            setDraft({ ...draft, end_year: v ? Number.parseInt(v, 10) : null })
          }
        />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={() => {
            setDraft(entry);
            setExpanded(false);
          }}
          className="rounded-full bg-[var(--color-surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)]"
        >
          Cancel
        </button>
        <button
          onClick={async () => {
            await onSave(draft);
            setExpanded(false);
          }}
          className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)]"
        >
          Save
        </button>
      </div>
    </div>
  );
}
