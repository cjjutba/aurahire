"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

export interface ExperienceEntry {
  id: string;
  title: string;
  company: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  responsibilities: string[];
  technologies_used: string[];
}

interface FieldInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
}

function FieldInput({ label, value, onChange, disabled, placeholder, required = false }: FieldInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-[var(--color-ink)]">
        {label}
        {required ? (
          <span aria-hidden className="text-[var(--color-status-danger)]"> *</span>
        ) : (
          <span className="font-normal text-[var(--color-muted)]"> (Optional)</span>
        )}
      </label>
      <input
        className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

interface Props {
  entry: ExperienceEntry;
  defaultExpanded?: boolean;
  onSave: (updated: ExperienceEntry) => Promise<void> | void;
  onDelete: () => void;
}

export function ExperienceCard({ entry, defaultExpanded = false, onSave, onDelete }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [draft, setDraft] = useState<ExperienceEntry>(entry);

  if (!expanded) {
    return (
      <div
        className="group cursor-pointer rounded-xl border border-[var(--color-hairline)] p-4 transition hover:border-[var(--color-primary-soft)]"
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[var(--color-ink)]">
              {entry.title || "Untitled"} · {entry.company || "—"}
            </div>
            <div className="font-mono text-xs text-[var(--color-muted)]">
              {entry.start_date ?? "?"} – {entry.is_current ? "Present" : (entry.end_date ?? "?")}
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
        <FieldInput label="Title" required value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
        <FieldInput label="Company" required value={draft.company} onChange={(v) => setDraft({ ...draft, company: v })} />
        <FieldInput
          label="Start (YYYY-MM)"
          value={draft.start_date ?? ""}
          placeholder="2022-01"
          onChange={(v) => setDraft({ ...draft, start_date: v || null })}
        />
        <FieldInput
          label="End (YYYY-MM)"
          value={draft.is_current ? "" : (draft.end_date ?? "")}
          placeholder="2023-06"
          disabled={draft.is_current}
          onChange={(v) => setDraft({ ...draft, end_date: v || null, is_current: false })}
        />
        <label className="col-span-full flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={draft.is_current}
            onChange={(e) =>
              setDraft({
                ...draft,
                is_current: e.target.checked,
                end_date: e.target.checked ? null : draft.end_date,
              })
            }
          />
          Currently here
        </label>
      </div>

      <div className="mt-4">
        <div className="mb-1 text-xs font-semibold text-[var(--color-ink)]">Responsibilities</div>
        {draft.responsibilities.map((r, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <textarea
              rows={2}
              className="flex-1 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
              value={r}
              onChange={(e) => {
                const copy = [...draft.responsibilities];
                copy[i] = e.target.value;
                setDraft({ ...draft, responsibilities: copy });
              }}
            />
            <button
              aria-label="Remove bullet"
              className="text-[var(--color-muted)] hover:text-[var(--color-status-danger)]"
              onClick={() =>
                setDraft({
                  ...draft,
                  responsibilities: draft.responsibilities.filter((_, j) => j !== i),
                })
              }
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          className="text-xs font-semibold text-[var(--color-primary)] underline"
          onClick={() => setDraft({ ...draft, responsibilities: [...draft.responsibilities, ""] })}
        >
          + Add bullet
        </button>
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
