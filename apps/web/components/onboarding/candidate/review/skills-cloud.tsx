"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { SKILLS_TAXONOMY } from "@aurahire/shared";
import { useHighlightContext } from "@/components/onboarding/resume-preview/highlight-context";

interface Props {
  initial: string[];
  onSync: (skills: string[]) => Promise<void>;
}

export function SkillsCloud({ initial, onSync }: Props) {
  const [skills, setSkills] = useState<string[]>(initial);
  const [query, setQuery] = useState("");
  const { setHoveredFieldId } = useHighlightContext();

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SKILLS_TAXONOMY.filter(
      (s) => s.toLowerCase().includes(q) && !skills.includes(s),
    ).slice(0, 8);
  }, [query, skills]);

  const add = (skill: string) => {
    if (!skill || skills.includes(skill)) return;
    const next = [...skills, skill];
    setSkills(next);
    setQuery("");
    onSync(next).catch(() => {
      setSkills(skills);
    });
  };

  const remove = (skill: string) => {
    const next = skills.filter((s) => s !== skill);
    setSkills(next);
    onSync(next).catch(() => {
      setSkills(skills);
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Skills <span className="font-mono text-xs">{skills.length}</span>
      </h3>
      {skills.length === 0 && (
        <p className="text-sm text-[var(--color-muted)]">
          No skills found yet.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {skills.map((s, i) => (
          <span
            key={s}
            data-field-id={`skill.${i}`}
            onMouseEnter={() => setHoveredFieldId(`skill.${i}`)}
            onMouseLeave={() => setHoveredFieldId(null)}
            className="group flex items-center gap-1.5 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-medium text-[var(--color-primary)]"
          >
            {s}
            <button
              onClick={() => remove(s)}
              aria-label={`Remove ${s}`}
              className="opacity-60 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              e.preventDefault();
              add(query.trim());
            }
          }}
          placeholder="Add a skill, e.g. TypeScript"
          className="w-full rounded-full border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
        />
        {suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-auto rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
            {suggestions.map((s) => (
              <li
                key={s}
                className="cursor-pointer px-4 py-2 text-sm hover:bg-[var(--color-surface-soft)]"
                onClick={() => add(s)}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
