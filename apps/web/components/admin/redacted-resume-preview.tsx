"use client";

interface Props {
  parsedResume: Record<string, unknown> | null;
  redactedFields: string[];
}

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  address: "Address",
  date_of_birth: "Date of Birth",
  age: "Age",
  gender: "Gender",
  photo: "Photo URL",
  contact: "Contact (Block)",
  summary: "Professional Summary",
  headline: "Headline",
  location_city: "City",
  location_country: "Country",
};

const REDACTED_PLACEHOLDER = "••••••";

interface FieldRow {
  key: string;
  label: string;
  value: string;
  redacted: boolean;
}

function flattenForPreview(
  parsed: Record<string, unknown>,
  redactedSet: Set<string>,
): FieldRow[] {
  const rows: FieldRow[] = [];

  // Top-level scalars
  for (const [key, raw] of Object.entries(parsed)) {
    if (raw == null || typeof raw === "object") continue;
    rows.push({
      key,
      label: FIELD_LABELS[key] ?? key,
      value: String(raw),
      redacted: redactedSet.has(key),
    });
  }

  // Contact block (if present)
  const contact = parsed.contact as Record<string, unknown> | undefined;
  if (contact) {
    for (const [k, v] of Object.entries(contact)) {
      if (v == null) continue;
      const compositeKey = `contact.${k}`;
      const flatKey = k;
      const isRedacted =
        redactedSet.has(compositeKey) || redactedSet.has(flatKey);
      rows.push({
        key: compositeKey,
        label: FIELD_LABELS[k] ?? `Contact: ${k}`,
        value: typeof v === "string" ? v : JSON.stringify(v),
        redacted: isRedacted,
      });
    }
  }

  return rows;
}

export function RedactedResumePreview({
  parsedResume,
  redactedFields,
}: Props) {
  if (!parsedResume) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-4 text-sm text-[var(--color-muted)]">
        No parsed resume available.
      </div>
    );
  }

  const redactedSet = new Set(redactedFields);
  const fieldRows = flattenForPreview(parsedResume, redactedSet);

  // Skills + experience + education snapshots — admin only needs to confirm
  // they were preserved
  const skills =
    (parsedResume.skills as unknown[] | undefined)?.slice(0, 12) ?? [];
  const experienceCount = Array.isArray(parsedResume.experience)
    ? (parsedResume.experience as unknown[]).length
    : 0;
  const educationCount = Array.isArray(parsedResume.education)
    ? (parsedResume.education as unknown[]).length
    : 0;

  return (
    <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
      <header>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          What the AI saw (Redacted Resume Preview)
        </h3>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Reconstructed from the parsed resume + the persisted{" "}
          <code className="rounded bg-[var(--color-surface-soft)] px-1 font-mono">
            redactedFields
          </code>{" "}
          list. Fields marked{" "}
          <span className="font-mono text-[var(--color-status-danger)]">
            {REDACTED_PLACEHOLDER}
          </span>{" "}
          were stripped before scoring.
        </p>
      </header>

      <div className="space-y-2">
        {fieldRows.length === 0 ? (
          <p className="text-sm text-[var(--color-body)]">
            No top-level fields parsed.
          </p>
        ) : (
          fieldRows.map((r) => (
            <div
              key={r.key}
              className="flex items-baseline justify-between gap-3 border-b border-[var(--color-hairline-soft)] py-1 last:border-b-0"
            >
              <span className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                {r.label}
              </span>
              <span
                className={`break-all text-right text-sm ${
                  r.redacted
                    ? "font-mono text-[var(--color-status-danger)]"
                    : "text-[var(--color-ink)]"
                }`}
              >
                {r.redacted ? REDACTED_PLACEHOLDER : r.value}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="grid gap-3 border-t border-[var(--color-hairline)] pt-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
            Skills (visible)
          </p>
          <p className="mt-1 text-[var(--color-ink)]">
            {skills.length > 0
              ? `${skills.length} skill${skills.length === 1 ? "" : "s"}`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
            Experience (visible)
          </p>
          <p className="mt-1 text-[var(--color-ink)]">
            {experienceCount} entries
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
            Education (visible)
          </p>
          <p className="mt-1 text-[var(--color-ink)]">{educationCount} entries</p>
        </div>
      </div>
    </section>
  );
}
