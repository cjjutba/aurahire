import { describe, it, expect } from "vitest";
import { deriveHighlights } from "./derive-highlights";
import type { ParsedResumeV2 } from "@/app/onboarding/candidate/_steps";

const minimal: ParsedResumeV2 = {
  contact: {
    full_name: "Jane",
    full_name_source: "Jane Doe",
    email: null,
    email_source: null,
    phone: null,
    phone_source: null,
    location_city: null,
    location_city_source: null,
    location_country: null,
    location_country_source: null,
    linkedin_url: null,
    linkedin_url_source: null,
    portfolio_url: null,
    portfolio_url_source: null,
  },
  summary: { text: "Engineer", text_source: "Engineer with 5y exp" },
  education: [],
  experience: [],
  skills: [{ name: "TS", source: "TypeScript" }],
  certifications: [],
  languages: [],
  parse_confidence: "high",
};

describe("deriveHighlights", () => {
  it("emits one highlight per non-null *_source field", () => {
    const result = deriveHighlights(minimal);
    expect(result).toHaveLength(3); // full_name, summary, skill.0
    expect(result.map((r) => r.id)).toEqual([
      "contact.full_name",
      "summary",
      "skill.0",
    ]);
  });

  it("returns [] for null parsed input", () => {
    expect(deriveHighlights(null)).toEqual([]);
  });

  it("skips empty/whitespace-only source strings", () => {
    const empty: ParsedResumeV2 = {
      ...minimal,
      contact: { ...minimal.contact, full_name_source: "   " },
    };
    const result = deriveHighlights(empty);
    expect(result.find((r) => r.id === "contact.full_name")).toBeUndefined();
  });
});
