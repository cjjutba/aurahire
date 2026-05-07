import type { ParsedResumeV2 } from "@/app/onboarding/candidate/_steps";

export type HighlightCategory = "contact" | "summary" | "experience" | "education" | "skill";

export interface Highlight {
  id: string;
  category: HighlightCategory;
  source: string;
  fieldRef: string;
}

/**
 * Walk the parsed-resume v2 JSON and emit one Highlight per *_source field.
 * Skipped if the source string is null/empty (legacy parses without v2).
 */
export function deriveHighlights(parsed: ParsedResumeV2 | null | undefined): Highlight[] {
  if (!parsed) return [];
  const out: Highlight[] = [];
  const push = (
    id: string,
    category: HighlightCategory,
    source: string | null | undefined,
    fieldRef: string,
  ) => {
    if (source && source.trim().length > 0) {
      out.push({ id, category, source, fieldRef });
    }
  };

  const c = parsed.contact;
  push("contact.full_name", "contact", c.full_name_source, "fullName");
  push("contact.email", "contact", c.email_source, "email");
  push("contact.phone", "contact", c.phone_source, "phone");
  push("contact.location_city", "contact", c.location_city_source, "locationCity");
  push("contact.location_country", "contact", c.location_country_source, "locationCountry");
  push("contact.linkedin_url", "contact", c.linkedin_url_source, "linkedinUrl");
  push("contact.portfolio_url", "contact", c.portfolio_url_source, "portfolioUrl");

  if (parsed.summary) {
    push("summary", "summary", parsed.summary.text_source, "summary");
  }

  parsed.experience.forEach((e, i) => {
    push(`experience.${i}.title`, "experience", e.title_source, `experience.${i}.title`);
    push(`experience.${i}.company`, "experience", e.company_source, `experience.${i}.company`);
    push(`experience.${i}.period`, "experience", e.period_source, `experience.${i}.period`);
    e.responsibilities_source.forEach((s, j) => {
      push(
        `experience.${i}.responsibilities.${j}`,
        "experience",
        s,
        `experience.${i}.responsibilities.${j}`,
      );
    });
  });

  parsed.education.forEach((e, i) => {
    push(
      `education.${i}.institution`,
      "education",
      e.institution_source,
      `education.${i}.institution`,
    );
    push(`education.${i}.degree`, "education", e.degree_source, `education.${i}.degree`);
    push(
      `education.${i}.field_of_study`,
      "education",
      e.field_of_study_source,
      `education.${i}.field_of_study`,
    );
    push(`education.${i}.period`, "education", e.period_source, `education.${i}.period`);
    push(`education.${i}.gpa`, "education", e.gpa_source, `education.${i}.gpa`);
  });

  parsed.skills.forEach((s, i) => {
    push(`skill.${i}`, "skill", s.source, `skill.${i}`);
  });

  return out;
}
