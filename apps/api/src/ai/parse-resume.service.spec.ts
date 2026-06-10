import { ParseResumeService } from "./parse-resume.service";

describe("ParseResumeService.computeSourceCoverage", () => {
  // Use bracket-notation casts to access the private method directly so we don't
  // need to wire up a real OpenAI/Storage/Cache pipeline for a pure logic test.

  const svc = new ParseResumeService(
    { generateStructured: jest.fn() } as any,
    { download: jest.fn() } as any,
    { getOrSet: jest.fn() } as any,
  );

  it("returns coverage 1 when all sources are substrings of rawText", () => {
    const parsed = {
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
      summary: null,
      education: [],
      experience: [],
      skills: [],
      certifications: [],
      languages: [],
      parse_confidence: "high" as const,
    };
    const rawText = "Resume of Jane Doe - Software Engineer";
    const result = (svc as any).computeSourceCoverage(parsed, rawText);
    expect(result.coverage).toBe(1);
    expect(result.hallucinations).toHaveLength(0);
  });

  it("flags hallucinations when source isn't in rawText", () => {
    const parsed = {
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
      summary: null,
      education: [],
      experience: [],
      skills: [{ name: "TS", source: "TypeScript" }],
      certifications: [],
      languages: [],
      parse_confidence: "high" as const,
    };
    const rawText = "Jane Doe - JavaScript engineer"; // TypeScript NOT in rawText
    const result = (svc as any).computeSourceCoverage(parsed, rawText);
    expect(result.coverage).toBeCloseTo(0.5, 1); // 1/2 found
    expect(result.hallucinations).toContain("skills.0: TypeScript");
  });

  it("is whitespace-tolerant", () => {
    const parsed = {
      contact: {
        full_name: "Jane",
        full_name_source: "Jane   Doe", // extra spaces
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
      summary: null,
      education: [],
      experience: [],
      skills: [],
      certifications: [],
      languages: [],
      parse_confidence: "high" as const,
    };
    const rawText = "Jane Doe Engineer";
    const result = (svc as any).computeSourceCoverage(parsed, rawText);
    expect(result.coverage).toBe(1);
  });
});
