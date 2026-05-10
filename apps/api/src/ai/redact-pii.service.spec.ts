import type { ParsedResume } from "@aurahire/shared";

import { RedactPiiService, REDACTED_PLACEHOLDER } from "./redact-pii.service";

function buildResume(opts: {
  summaryText?: string | null;
  responsibilities: string[][];
}): ParsedResume {
  return {
    contact: {
      full_name: "Alice Smith",
      full_name_source: "Alice Smith",
      email: "alice@example.com",
      email_source: "alice@example.com",
      phone: "555-1234",
      phone_source: "555-1234",
      location_city: "NYC",
      location_city_source: "NYC",
      location_country: "USA",
      location_country_source: "USA",
      linkedin_url: "linkedin.com/in/alice",
      linkedin_url_source: "linkedin.com/in/alice",
      portfolio_url: "alice.dev",
      portfolio_url_source: "alice.dev",
    },
    summary:
      opts.summaryText === null
        ? null
        : {
            text:
              opts.summaryText ??
              "I am Alice, a senior backend engineer with 10 years of experience and a strong record.",
            text_source: "summary-source",
          },
    education: [],
    experience: opts.responsibilities.map((rs, i) => ({
      company: `Company${i}`,
      company_source: `Company${i}`,
      title: "Engineer",
      title_source: "Engineer",
      start_date: null,
      end_date: null,
      period_source: "",
      is_current: false,
      responsibilities: rs,
      responsibilities_source: rs.map(() => ""),
      technologies_used: [],
    })),
    skills: [],
    certifications: [],
    languages: [],
    parse_confidence: "high",
  };
}

describe("RedactPiiService.redactStructured", () => {
  it("replaces the five contact fields with [REDACTED] and reports them", () => {
    const svc = new RedactPiiService({
      generateStructured: jest.fn(),
      generateText: jest.fn(),
    } as never);
    const parsed = buildResume({ responsibilities: [] });

    const result = svc.redactStructured(parsed);

    expect(result.redacted.contact.full_name).toBe(REDACTED_PLACEHOLDER);
    expect(result.redacted.contact.email).toBe(REDACTED_PLACEHOLDER);
    expect(result.redacted.contact.phone).toBe(REDACTED_PLACEHOLDER);
    expect(result.redacted.contact.linkedin_url).toBe(REDACTED_PLACEHOLDER);
    expect(result.redacted.contact.portfolio_url).toBe(REDACTED_PLACEHOLDER);
    expect(result.redactedFields).toEqual([
      "contact.full_name",
      "contact.email",
      "contact.phone",
      "contact.linkedin_url",
      "contact.portfolio_url",
    ]);
  });

  it("leaves originally-null contact fields as null (no false presence)", () => {
    const svc = new RedactPiiService({
      generateStructured: jest.fn(),
      generateText: jest.fn(),
    } as never);
    const parsed = buildResume({ responsibilities: [] });
    parsed.contact.phone = null;
    parsed.contact.linkedin_url = null;

    const result = svc.redactStructured(parsed);

    expect(result.redacted.contact.phone).toBeNull();
    expect(result.redacted.contact.linkedin_url).toBeNull();
    expect(result.redactedFields).toEqual([
      "contact.full_name",
      "contact.email",
      "contact.portfolio_url",
    ]);
  });

  it("does not mutate the input parsed resume", () => {
    const svc = new RedactPiiService({
      generateStructured: jest.fn(),
      generateText: jest.fn(),
    } as never);
    const parsed = buildResume({ responsibilities: [] });

    svc.redactStructured(parsed);

    expect(parsed.contact.full_name).toBe("Alice Smith");
    expect(parsed.contact.email).toBe("alice@example.com");
  });
});

describe("RedactPiiService.redactResume batching", () => {
  it("makes ONE structured call covering summary + every responsibility", async () => {
    const generateStructured = jest.fn(async (opts: { userPrompt: string }) => {
      // Echo every input id back as scrubbed:<id> so we can verify pairing.
      const arrStart = opts.userPrompt.indexOf("[");
      const items = JSON.parse(opts.userPrompt.slice(arrStart)) as Array<{
        id: string;
        text: string;
      }>;
      return {
        data: {
          items: items.map((it) => ({
            id: it.id,
            scrubbed: `scrubbed:${it.id}`,
          })),
        },
        latencyMs: 100,
        model: "gpt-4o-mini",
        promptTokens: 0,
        completionTokens: 0,
      };
    });
    const svc = new RedactPiiService({
      generateStructured,
      generateText: jest.fn(),
    } as never);

    const parsed = buildResume({
      responsibilities: [
        [
          "Led customer-facing API platform serving 8 thousand daily active users.",
          "Owned migration from monolith to NestJS-based service mesh, reducing p95.",
        ],
        [
          "Built React/Redux dashboard consumed by product, support, and finance teams.",
        ],
      ],
    });

    const result = await svc.redactResume(parsed, "test-req");

    expect(generateStructured).toHaveBeenCalledTimes(1);
    expect(result.redacted.summary?.text).toBe("scrubbed:summary");
    expect(result.redacted.experience[0]!.responsibilities[0]).toBe(
      "scrubbed:experience.0.responsibilities.0",
    );
    expect(result.redactedFields).toEqual([
      "contact.full_name",
      "contact.email",
      "contact.phone",
      "contact.linkedin_url",
      "contact.portfolio_url",
      "summary",
      "experience.0.responsibilities.0",
      "experience.0.responsibilities.1",
      "experience.1.responsibilities.0",
    ]);
  });

  it("does not make any AI call when there are no free-text fields", async () => {
    const generateStructured = jest.fn();
    const svc = new RedactPiiService({
      generateStructured,
      generateText: jest.fn(),
    } as never);

    const parsed = buildResume({
      summaryText: null,
      responsibilities: [],
    });

    await svc.redactResume(parsed);
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("falls back to keeping originals if AI returns missing ids", async () => {
    const generateStructured = jest.fn(async () => ({
      data: { items: [] },
      latencyMs: 0,
      model: "gpt-4o-mini",
      promptTokens: 0,
      completionTokens: 0,
    }));
    const svc = new RedactPiiService({
      generateStructured,
      generateText: jest.fn(),
    } as never);

    const original =
      "Led 4-engineer team migrating legacy Express monolith to a NestJS-based service mesh.";
    const parsed = buildResume({
      summaryText: null,
      responsibilities: [[original]],
    });

    const result = await svc.redactResume(parsed);
    expect(result.redacted.experience[0]!.responsibilities[0]).toBe(original);
    expect(result.redactedFields).not.toContain(
      "experience.0.responsibilities.0",
    );
  });

  it("survives an OpenAI failure by keeping originals (best-effort)", async () => {
    const generateStructured = jest.fn(async () => {
      throw new Error("OpenAI 503");
    });
    const svc = new RedactPiiService({
      generateStructured,
      generateText: jest.fn(),
    } as never);

    const original =
      "Built customer-facing analytics dashboard used across the product and finance orgs.";
    const parsed = buildResume({
      summaryText: null,
      responsibilities: [[original]],
    });

    const result = await svc.redactResume(parsed);
    expect(result.redacted.experience[0]!.responsibilities[0]).toBe(original);
    // Contact-field redactions still applied even when AI batch fails.
    expect(result.redactedFields).toContain("contact.email");
  });

  it("skips free-text fields below FREE_TEXT_MIN_LENGTH (50 chars)", async () => {
    const generateStructured = jest.fn(async (opts: { userPrompt: string }) => {
      const arrStart = opts.userPrompt.indexOf("[");
      const items = JSON.parse(opts.userPrompt.slice(arrStart)) as Array<{
        id: string;
        text: string;
      }>;
      return {
        data: {
          items: items.map((it) => ({
            id: it.id,
            scrubbed: `scrubbed:${it.id}`,
          })),
        },
        latencyMs: 0,
        model: "gpt-4o-mini",
        promptTokens: 0,
        completionTokens: 0,
      };
    });
    const svc = new RedactPiiService({
      generateStructured,
      generateText: jest.fn(),
    } as never);

    const parsed = buildResume({
      summaryText: "Short summary.",
      responsibilities: [
        [
          "Tiny task.",
          "Led customer-facing analytics platform serving thousands of users.",
        ],
      ],
    });

    const result = await svc.redactResume(parsed);
    // Only the 1 long responsibility was sent.
    expect(generateStructured).toHaveBeenCalledTimes(1);
    expect(result.redactedFields).toContain("experience.0.responsibilities.1");
    expect(result.redactedFields).not.toContain("summary");
    expect(result.redactedFields).not.toContain(
      "experience.0.responsibilities.0",
    );
  });
});
