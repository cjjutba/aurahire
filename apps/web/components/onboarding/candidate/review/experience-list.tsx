"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ExperienceCard, type ExperienceEntry } from "./experience-card";

let tmpCounter = 0;
const tmpId = () => `tmp-exp-${++tmpCounter}-${Date.now()}`;

interface Props {
  initial: ExperienceEntry[];
  onSync: (entries: ExperienceEntry[]) => Promise<void>;
}

export function ExperienceList({ initial, onSync }: Props) {
  const [entries, setEntries] = useState<ExperienceEntry[]>(initial);

  const update = async (next: ExperienceEntry[]) => {
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
    toast("Experience removed", {
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
        Experience <span className="font-mono text-xs">{entries.length}</span>
      </h3>
      {entries.length === 0 && (
        <p className="text-sm text-[var(--color-muted)]">
          No work experience parsed from your resume.
        </p>
      )}
      {entries.map((e) => (
        <ExperienceCard
          key={e.id}
          entry={e}
          defaultExpanded={e.id.startsWith("tmp-exp-")}
          onSave={(updated) => update(entries.map((x) => (x.id === e.id ? updated : x)))}
          onDelete={() => handleDelete(e.id)}
        />
      ))}
      <button
        onClick={() => {
          const newEntry: ExperienceEntry = {
            id: tmpId(),
            title: "",
            company: "",
            start_date: null,
            end_date: null,
            is_current: false,
            responsibilities: [],
            technologies_used: [],
          };
          setEntries([...entries, newEntry]);
        }}
        className="w-full rounded-xl border border-dashed border-[var(--color-hairline)] p-3 text-sm text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
      >
        + Add experience
      </button>
    </div>
  );
}
