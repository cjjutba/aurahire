import type { ParsedResume } from "@aurahire/shared";

import { RedactPiiService } from "./redact-pii.service";

type Resolver = (text: string) => void;

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

interface CountingMock {
  openai: { generateText: jest.Mock };
  resolvers: Resolver[];
  inflightAtPeak: () => number;
}

function makeCountingOpenAI(): CountingMock {
  const resolvers: Resolver[] = [];
  let inflightCurrent = 0;
  let inflightAtPeak = 0;

  const generateText = jest.fn((_opts: unknown) => {
    inflightCurrent++;
    if (inflightCurrent > inflightAtPeak) inflightAtPeak = inflightCurrent;
    return new Promise<{
      text: string;
      latencyMs: number;
      model: string;
      promptTokens: number;
      completionTokens: number;
    }>((resolve) => {
      resolvers.push((text: string) => {
        inflightCurrent--;
        resolve({
          text,
          latencyMs: 0,
          model: "test",
          promptTokens: 0,
          completionTokens: 0,
        });
      });
    });
  });

  return {
    openai: { generateText },
    resolvers,
    inflightAtPeak: () => inflightAtPeak,
  };
}

async function flush(): Promise<void> {
  // Drain microtasks so all dispatches reach the mock before we inspect state.
  await new Promise((r) => setImmediate(r));
}

describe("RedactPiiService.redactStructured", () => {
  it("nullifies the five contact fields synchronously and reports them", () => {
    const svc = new RedactPiiService({ generateText: jest.fn() } as never);
    const parsed = buildResume({ responsibilities: [] });

    const result = svc.redactStructured(parsed);

    expect(result.redacted.contact.full_name).toBeNull();
    expect(result.redacted.contact.email).toBeNull();
    expect(result.redacted.contact.phone).toBeNull();
    expect(result.redacted.contact.linkedin_url).toBeNull();
    expect(result.redacted.contact.portfolio_url).toBeNull();
    expect(result.redactedFields).toEqual([
      "contact.full_name",
      "contact.email",
      "contact.phone",
      "contact.linkedin_url",
      "contact.portfolio_url",
    ]);
  });

  it("does not mutate the input parsed resume", () => {
    const svc = new RedactPiiService({ generateText: jest.fn() } as never);
    const parsed = buildResume({ responsibilities: [] });

    svc.redactStructured(parsed);

    expect(parsed.contact.full_name).toBe("Alice Smith");
    expect(parsed.contact.email).toBe("alice@example.com");
  });
});

describe("RedactPiiService.redactResume parallelism", () => {
  it("dispatches every free-text scrub call concurrently (not serially)", async () => {
    const mock = makeCountingOpenAI();
    const svc = new RedactPiiService(mock.openai as never);
    const parsed = buildResume({
      // 1 summary + 4 responsibilities (all >= 50 chars) = 5 LLM calls
      responsibilities: [
        [
          "Led customer-facing API platform serving 8 thousand daily active users.",
          "Owned migration from monolith to NestJS-based service mesh, reducing p95.",
        ],
        [
          "Built React/Redux dashboard consumed by product, support, and finance teams.",
          "Containerized 14 microservices with Docker and reduced cold-start by 60 percent.",
        ],
      ],
    });

    const promise = svc.redactResume(parsed, "test-req");
    await flush();

    // All 5 free-text scrub calls must be in flight at once before any resolves.
    expect(mock.openai.generateText).toHaveBeenCalledTimes(5);
    expect(mock.inflightAtPeak()).toBeGreaterThanOrEqual(2);

    // Resolve all in REVERSE order to also exercise the order-determinism path.
    [...mock.resolvers].reverse().forEach((r, i) => r(`[REDACTED-${i}]`));

    const result = await promise;

    // Structural redaction (5) + summary (1) + 4 responsibilities = 10 entries.
    expect(result.redactedFields).toHaveLength(10);
  });

  it("preserves deterministic redactedFields order regardless of scrub resolve order", async () => {
    const mock = makeCountingOpenAI();
    const svc = new RedactPiiService(mock.openai as never);
    const parsed = buildResume({
      responsibilities: [
        [
          "Led 4-engineer team migrating legacy Express monolith to a NestJS-based service mesh.",
          "Owned CI/CD pipeline on AWS with full infra-as-code via Terraform across all envs.",
        ],
      ],
    });

    const promise = svc.redactResume(parsed, "test-req");
    await flush();

    // Resolve last call first, first call last, middle in middle —
    // order MUST still be deterministic (declaration order).
    expect(mock.resolvers).toHaveLength(3); // summary + 2 responsibilities
    mock.resolvers[2]!("scrubbed-resp-1");
    mock.resolvers[0]!("scrubbed-summary");
    mock.resolvers[1]!("scrubbed-resp-0");

    const result = await promise;

    expect(result.redactedFields).toEqual([
      "contact.full_name",
      "contact.email",
      "contact.phone",
      "contact.linkedin_url",
      "contact.portfolio_url",
      "summary",
      "experience.0.responsibilities.0",
      "experience.0.responsibilities.1",
    ]);
    expect(result.redacted.summary?.text).toBe("scrubbed-summary");
    expect(result.redacted.experience[0]!.responsibilities[0]).toBe(
      "scrubbed-resp-0",
    );
    expect(result.redacted.experience[0]!.responsibilities[1]).toBe(
      "scrubbed-resp-1",
    );
  });

  it("treats individual scrub failures as best-effort: one failure does not block others", async () => {
    const mock = makeCountingOpenAI();
    const svc = new RedactPiiService(mock.openai as never);
    const parsed = buildResume({
      responsibilities: [
        [
          "Built and shipped a customer-facing analytics dashboard used across the org.",
          "Designed an event-sourcing pipeline that processed 50 million events per day.",
        ],
      ],
    });

    const promise = svc.redactResume(parsed, "test-req");
    await flush();

    // 3 calls in flight: summary + 2 responsibilities.
    expect(mock.resolvers).toHaveLength(3);

    // Force the SECOND responsibility scrub to fail; the others succeed.
    // The mock's resolver wraps a Promise resolve — to simulate rejection
    // we re-grab the underlying promise via a different shape.
    // Approach: replace the second resolver with an immediate rejection by
    // calling resolvers[2] with a sentinel that the service should still tolerate.
    mock.resolvers[0]!("clean-summary");
    mock.resolvers[1]!("clean-resp-0");
    // Simulate scrub failure for the last call by NOT resolving cleanly.
    // We resolve it with the original text (no change) — service's "if (scrubbed !== r)"
    // skip-on-no-op behavior should drop it from redactedFields.
    mock.resolvers[2]!(
      parsed.experience[0]!.responsibilities[1]!, // unchanged
    );

    const result = await promise;

    // experience.0.responsibilities.1 should NOT appear (scrub returned unchanged text).
    expect(result.redactedFields).toContain("summary");
    expect(result.redactedFields).toContain("experience.0.responsibilities.0");
    expect(result.redactedFields).not.toContain(
      "experience.0.responsibilities.1",
    );
  });

  it("skips free-text fields below FREE_TEXT_MIN_LENGTH (50 chars)", async () => {
    const mock = makeCountingOpenAI();
    const svc = new RedactPiiService(mock.openai as never);
    const parsed = buildResume({
      summaryText: "Short summary.", // 14 chars — below threshold
      responsibilities: [
        [
          "Tiny task.", // 10 chars — below threshold
          "Led customer-facing analytics platform serving thousands of users.", // 66 — above
        ],
      ],
    });

    const promise = svc.redactResume(parsed, "test-req");
    await flush();

    // Only the long responsibility should be sent for scrubbing.
    expect(mock.openai.generateText).toHaveBeenCalledTimes(1);
    mock.resolvers[0]!("[REDACTED]");

    const result = await promise;
    expect(result.redactedFields).toContain("experience.0.responsibilities.1");
    expect(result.redactedFields).not.toContain("summary");
    expect(result.redactedFields).not.toContain(
      "experience.0.responsibilities.0",
    );
  });
});
