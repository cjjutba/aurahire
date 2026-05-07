import type { CandidateProfileMe } from "@/app/onboarding/candidate/_steps";

interface ExperienceLike {
  title: string;
  company: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
}

interface Props {
  me: CandidateProfileMe;
  experience: ExperienceLike[];
  skills: string[];
}

export function ProfilePreviewPane({ me, experience, skills }: Props) {
  const initials = (me.fullName ?? "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
        What recruiters see
      </p>
      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-base font-semibold text-[var(--color-primary)]">
          {initials || "?"}
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-[var(--color-ink)]">
            {me.fullName}
          </div>
          {me.headline && (
            <div className="truncate text-xs text-[var(--color-muted)]">{me.headline}</div>
          )}
          {(me.locationCity || me.locationCountry) && (
            <div className="truncate text-xs text-[var(--color-muted)]">
              {[me.locationCity, me.locationCountry].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
      </div>
      {me.summary && (
        <p className="mt-4 line-clamp-4 text-sm leading-6 text-[var(--color-body)]">
          {me.summary}
        </p>
      )}
      {experience.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
            Recent experience
          </p>
          <ul className="mt-2 space-y-2">
            {experience.slice(0, 3).map((e, i) => (
              <li key={i}>
                <div className="text-sm font-semibold text-[var(--color-ink)]">{e.title}</div>
                <div className="text-xs text-[var(--color-muted)]">
                  {e.company} ·{" "}
                  <span className="font-mono">
                    {e.start_date ?? "?"} – {e.is_current ? "Present" : e.end_date ?? "?"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {skills.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
            Top skills
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {skills.slice(0, 8).map((s) => (
              <li
                key={s}
                className="rounded-full bg-[var(--color-surface-strong)] px-2.5 py-0.5 text-[11px]"
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
