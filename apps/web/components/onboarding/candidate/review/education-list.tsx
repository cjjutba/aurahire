"use client";

import { useState } from "react";
import { toast } from "sonner";
import { EducationCard, type EducationEntry } from "./education-card";

let tmpCounter = 0;
const tmpId = () => `tmp-edu-${++tmpCounter}-${Date.now()}`;

interface Props {
  initial: EducationEntry[];
  onSync: (entries: EducationEntry[]) => Promise<void>;
}

export function EducationList({ initial, onSync }: Props) {
  const [entries, setEntries] = useState<EducationEntry[]>(initial);

  const update = async (next: EducationEntry[]) => {
    const prev = entries;
    setEntries(next);
    try {
      await onSync(next);
    } catch {
      setEntries(prev);
      toast.error("Couldn't save — try again");
    }
  };

  const handleDelete = (id: string) => {
    const removed = entries.find((e) => e.id === id);
    if (!removed) return;
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    let undone = false;
    toast("Education removed", {
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          setEntries(entries);
        },
      },
    });
    setTimeout(() => {
      if (!undone) {
        onSync(next).catch(() => {
          toast.error("Couldn't save");
          setEntries(entries);
        });
      }
    }, 5000);
  };

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Education <span className="font-mono text-xs">{entries.length}</span>
      </h3>
      {entries.length === 0 && (
        <p className="text-sm text-[var(--color-muted)]">No education parsed.</p>
      )}
      {entries.map((e) => (
        <EducationCard
          key={e.id}
          entry={e}
          defaultExpanded={e.id.startsWith("tmp-edu-")}
          onSave={(updated) => update(entries.map((x) => (x.id === e.id ? updated : x)))}
          onDelete={() => handleDelete(e.id)}
        />
      ))}
      <button
        onClick={() => {
          const newEntry: EducationEntry = {
            id: tmpId(),
            institution: "",
            degree: null,
            field_of_study: null,
            start_year: null,
            end_year: null,
            gpa: null,
          };
          setEntries([...entries, newEntry]);
        }}
        className="w-full rounded-xl border border-dashed border-[var(--color-hairline)] p-3 text-sm text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
      >
        + Add education
      </button>
    </div>
  );
}
