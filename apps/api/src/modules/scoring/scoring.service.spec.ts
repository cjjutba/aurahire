import type Redis from "ioredis";
import type {
  MatchScorePreview,
  Resume,
  ScoringConfig,
  Job,
} from "@aurahire/db";
import { ONVIEW_DAILY_CAP, type AuthUser } from "@aurahire/shared";
import { ForbiddenException } from "@nestjs/common";

import {
  ScoringService,
  reconcileEvidenceContributions,
  detectCalibrationWarnings,
  buildDeterministicCompletenessComponent,
} from "./scoring.service";
import type { ParsedResume } from "@aurahire/shared";
import type { ScoringRepository } from "./scoring.repository";
import type { ResumesRepository } from "../resumes/resumes.repository";
import type { JobsRepository } from "../jobs/jobs.repository";
import type { ProfilesRepository } from "../profiles/profiles.repository";
import type { ScoreProfileService } from "../../ai/score-profile.service";
import type { ScoreMatchService } from "../../ai/score-match.service";
import type { AuditService } from "../../audit";
import type { CacheService } from "../../cache";
import type { EventsService } from "../../realtime";

describe("reconcileEvidenceContributions", () => {
  function buildComponent(
    overrides: Partial<{
      name: string;
      score: number;
      max: number;
      evidence: Array<{
        excerpt: string;
        source: string;
        relevance: "positive" | "negative" | "neutral";
        contribution_points: number;
      }>;
    }> = {},
  ) {
    return {
      name: "skills",
      score: 0,
      max: 40,
      weight: 40,
      explanation: "test",
      evidence: [],
      ...overrides,
    };
  }

  it("reconciles when AI got the math right (sum equals score)", () => {
    const result = reconcileEvidenceContributions(
      buildComponent({
        score: 25,
        evidence: [
          {
            excerpt: "TS",
            source: "skills",
            relevance: "positive",
            contribution_points: 10,
          },
          {
            excerpt: "PG",
            source: "skills",
            relevance: "positive",
            contribution_points: 10,
          },
          {
            excerpt: "Docker",
            source: "skills",
            relevance: "positive",
            contribution_points: 5,
          },
        ],
      }),
    );
    expect(result.component.score).toBe(25);
    expect(result.residual).toBe(0);
    expect(result.quantizationDeltas).toHaveLength(0);
  });

  it("overrides AI score when it disagrees with sum of contributions", () => {
    const result = reconcileEvidenceContributions(
      buildComponent({
        score: 30, // AI claimed 30
        evidence: [
          {
            excerpt: "TS",
            source: "skills",
            relevance: "positive",
            contribution_points: 10,
          },
          {
            excerpt: "PG",
            source: "skills",
            relevance: "positive",
            contribution_points: 10,
          },
          {
            excerpt: "Docker",
            source: "skills",
            relevance: "positive",
            contribution_points: 5,
          },
        ],
      }),
    );
    expect(result.component.score).toBe(25); // sum wins
    expect(result.residual).toBe(5); // ai_score - derived
  });

  it("quantizes non-multiples of 5 to nearest 5", () => {
    const result = reconcileEvidenceContributions(
      buildComponent({
        score: 15,
        evidence: [
          {
            excerpt: "a",
            source: "skills",
            relevance: "positive",
            contribution_points: 7,
          },
          {
            excerpt: "b",
            source: "skills",
            relevance: "positive",
            contribution_points: 8,
          },
        ],
      }),
    );
    expect(result.component.evidence[0]!.contribution_points).toBe(5);
    expect(result.component.evidence[1]!.contribution_points).toBe(10);
    expect(result.component.score).toBe(15); // 5 + 10 = 15
    expect(result.quantizationDeltas).toHaveLength(2);
    expect(result.quantizationDeltas[0]).toEqual({
      evidenceIndex: 0,
      original: 7,
      quantized: 5,
    });
  });

  it("clamps below zero", () => {
    const result = reconcileEvidenceContributions(
      buildComponent({
        score: 10,
        evidence: [
          {
            excerpt: "gap1",
            source: "req",
            relevance: "negative",
            contribution_points: -15,
          },
          {
            excerpt: "gap2",
            source: "req",
            relevance: "negative",
            contribution_points: -15,
          },
        ],
      }),
    );
    expect(result.component.score).toBe(0); // clamped from -30
    expect(result.residual).toBe(10); // ai_score 10 - derived 0
  });

  it("clamps above max", () => {
    const result = reconcileEvidenceContributions(
      buildComponent({
        score: 20,
        max: 15,
        evidence: [
          {
            excerpt: "a",
            source: "skills",
            relevance: "positive",
            contribution_points: 10,
          },
          {
            excerpt: "b",
            source: "skills",
            relevance: "positive",
            contribution_points: 10,
          },
        ],
      }),
    );
    expect(result.component.score).toBe(15); // clamped from 20
    expect(result.residual).toBe(5); // ai_score 20 - derived 15
  });

  it("forces relevance from sign even when AI lied", () => {
    const result = reconcileEvidenceContributions(
      buildComponent({
        score: 0,
        evidence: [
          // AI mislabeled a -10 as positive - engine forces it back to negative.
          {
            excerpt: "no Go",
            source: "req",
            relevance: "positive",
            contribution_points: -10,
          },
        ],
      }),
    );
    expect(result.component.evidence[0]!.relevance).toBe("negative");
  });

  it("preserves neutral relevance for zero contributions", () => {
    const result = reconcileEvidenceContributions(
      buildComponent({
        score: 0,
        evidence: [
          {
            excerpt: "context",
            source: "summary",
            relevance: "neutral",
            contribution_points: 0,
          },
        ],
      }),
    );
    expect(result.component.evidence[0]!.relevance).toBe("neutral");
    expect(result.component.score).toBe(0);
  });
});

describe("buildDeterministicCompletenessComponent", () => {
  function buildParsed(overrides: Partial<ParsedResume> = {}): ParsedResume {
    const base: ParsedResume = {
      contact: {
        full_name: "Alex Doe",
        full_name_source: "Alex Doe",
        email: "alex@example.com",
        email_source: "alex@example.com",
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
      summary: {
        text: "10+ years of platform engineering.",
        text_source: "src",
      },
      education: [
        {
          institution: "State U",
          institution_source: "State U",
          degree: "BS",
          degree_source: "BS",
          field_of_study: "CS",
          field_of_study_source: "CS",
          start_year: 2010,
          end_year: 2014,
          period_source: "2010-2014",
          gpa: null,
          gpa_source: null,
        },
      ],
      experience: [
        {
          company: "Acme",
          company_source: "Acme",
          title: "Senior Engineer",
          title_source: "Senior Engineer",
          start_date: "2020-01",
          end_date: null,
          period_source: "2020-now",
          is_current: true,
          responsibilities: ["Led platform team."],
          responsibilities_source: ["Led platform team."],
          technologies_used: ["TypeScript"],
        },
      ],
      skills: [{ name: "TypeScript", source: "TypeScript" }],
      certifications: [],
      languages: [],
      parse_confidence: "high",
    };
    return { ...base, ...overrides } as ParsedResume;
  }

  it("scores 25/25 with 5 positives when every section is filled", () => {
    const c = buildDeterministicCompletenessComponent(buildParsed(), 25);
    expect(c.score).toBe(25);
    expect(c.max).toBe(25);
    expect(c.evidence).toHaveLength(5);
    expect(c.evidence.every((e) => e.relevance === "positive")).toBe(true);
    expect(c.evidence.every((e) => e.contribution_points === 5)).toBe(true);
    expect(c.explanation).toContain("All 5 resume sections are present");
  });

  it("emits a negative evidence row for each missing section", () => {
    const parsed = buildParsed({ summary: null, skills: [] });
    const c = buildDeterministicCompletenessComponent(parsed, 25);
    expect(c.score).toBeLessThan(25);
    const negatives = c.evidence.filter((e) => e.relevance === "negative");
    const positives = c.evidence.filter((e) => e.relevance === "positive");
    expect(negatives).toHaveLength(2);
    expect(positives).toHaveLength(3);
    expect(c.explanation).toMatch(
      /Missing:.*summary.*skills|Missing:.*skills.*summary/,
    );
  });

  it("clamps to 0 when no canonical sections are present", () => {
    const parsed = buildParsed({
      contact: {
        full_name: null,
        full_name_source: null,
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
    });
    const c = buildDeterministicCompletenessComponent(parsed, 25);
    expect(c.score).toBe(0);
    expect(c.evidence.every((e) => e.relevance === "negative")).toBe(true);
  });

  it("treats redaction sentinel values as filled (presence preserved)", () => {
    // After redactStructured runs, contact fields are "[REDACTED]" - that
    // sentinel still counts as presence for the structural completeness check.
    const parsed = buildParsed({
      contact: {
        full_name: "[REDACTED]",
        full_name_source: "Alex Doe",
        email: "[REDACTED]",
        email_source: "alex@example.com",
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
    });
    const c = buildDeterministicCompletenessComponent(parsed, 25);
    expect(c.score).toBe(25);
  });
});

describe("detectCalibrationWarnings", () => {
  function buildComponent(
    overrides: Partial<{
      name: string;
      score: number;
      max: number;
      evidence: Array<{
        excerpt: string;
        source: string;
        relevance: "positive" | "negative" | "neutral";
        contribution_points: number;
      }>;
    }> = {},
  ) {
    return {
      name: "skills",
      score: 0,
      max: 40,
      weight: 40,
      explanation: "test",
      evidence: [],
      ...overrides,
    };
  }

  it("flags ceiling with only one positive evidence item", () => {
    const warnings = detectCalibrationWarnings(
      buildComponent({
        score: 40,
        max: 40,
        evidence: [
          {
            excerpt: "TS",
            source: "skills",
            relevance: "positive",
            contribution_points: 40,
          },
        ],
      }),
    );
    expect(warnings).toEqual([
      { componentName: "skills", reason: "ceiling_with_thin_evidence" },
    ]);
  });

  it("does not flag ceiling with two or more positive items", () => {
    const warnings = detectCalibrationWarnings(
      buildComponent({
        score: 40,
        max: 40,
        evidence: [
          {
            excerpt: "TS",
            source: "skills",
            relevance: "positive",
            contribution_points: 20,
          },
          {
            excerpt: "PG",
            source: "skills",
            relevance: "positive",
            contribution_points: 20,
          },
        ],
      }),
    );
    expect(warnings).toEqual([]);
  });

  it("flags below-max with no negative evidence", () => {
    const warnings = detectCalibrationWarnings(
      buildComponent({
        score: 25,
        max: 30,
        evidence: [
          {
            excerpt: "a",
            source: "skills",
            relevance: "positive",
            contribution_points: 15,
          },
          {
            excerpt: "b",
            source: "skills",
            relevance: "positive",
            contribution_points: 10,
          },
        ],
      }),
    );
    expect(warnings).toEqual([
      {
        componentName: "skills",
        reason: "deduction_without_negative_evidence",
      },
    ]);
  });

  it("does not flag below-max when negative evidence is present", () => {
    const warnings = detectCalibrationWarnings(
      buildComponent({
        score: 25,
        max: 30,
        evidence: [
          {
            excerpt: "a",
            source: "skills",
            relevance: "positive",
            contribution_points: 30,
          },
          {
            excerpt: "gap",
            source: "req",
            relevance: "negative",
            contribution_points: -5,
          },
        ],
      }),
    );
    expect(warnings).toEqual([]);
  });

  it("returns empty array for a healthy at-zero component", () => {
    const warnings = detectCalibrationWarnings(
      buildComponent({
        score: 0,
        max: 40,
        evidence: [
          {
            excerpt: "no match",
            source: "req",
            relevance: "negative",
            contribution_points: -40,
          },
        ],
      }),
    );
    expect(warnings).toEqual([]);
  });

  it("fires `deduction_without_negative_evidence` for the 2026-05-10 screenshot failure mode (Skills 20/40 with two positives + two neutrals quoting requirements)", () => {
    const warnings = detectCalibrationWarnings(
      buildComponent({
        name: "skills",
        score: 20,
        max: 40,
        evidence: [
          {
            excerpt: "TypeScript",
            source: "skills",
            relevance: "positive",
            contribution_points: 10,
          },
          {
            excerpt: "Kubernetes",
            source: "skills",
            relevance: "positive",
            contribution_points: 10,
          },
          {
            excerpt: "Go, Backstage, Bazel",
            source: "Job requirement › Required Skills",
            relevance: "neutral",
            contribution_points: 0,
          },
          {
            excerpt: "JavaScript, React, Node.js, AWS, Docker",
            source: "skills",
            relevance: "neutral",
            contribution_points: 0,
          },
        ],
      }),
    );
    expect(warnings).toEqual([
      {
        componentName: "skills",
        reason: "deduction_without_negative_evidence",
      },
    ]);
  });
});

describe("ScoringService.computeMatchPreviewOnView", () => {
  const candidateId = "11111111-1111-1111-1111-111111111111";
  const jobId = "22222222-2222-2222-2222-222222222222";
  const resumeId = "33333333-3333-3333-3333-333333333333";
  const companyId = "44444444-4444-4444-4444-444444444444";

  const today = () => new Date().toISOString().slice(0, 10);
  const counterKey = () => `scoring:onview:${candidateId}:${today()}`;

  function buildCandidateUser(overrides: Partial<AuthUser> = {}): AuthUser {
    return {
      id: candidateId,
      email: "candidate@example.com",
      role: "candidate",
      status: "active",
      fullName: "Test Candidate",
      profileCompleted: true,
      ...overrides,
    };
  }

  function buildResume(): Resume {
    return {
      id: resumeId,
      candidateId,
      filename: "resume.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1234,
      storagePath: `${candidateId}/source.pdf`,
      canonicalPdfPath: null,
      rawText: "raw text",
      parsedData: { parse_confidence: 0.9 } as Record<string, unknown>,
      parseStatus: "parsed",
      parseError: null,
      isDefault: true,
      createdAt: new Date("2026-05-08T00:00:00Z"),
      updatedAt: new Date("2026-05-08T00:00:00Z"),
    };
  }

  function buildJob(): Job {
    return {
      id: jobId,
      companyId,
      title: "Senior Software Engineer",
      slug: "senior-software-engineer",
      department: "Engineering",
      employmentType: "full_time",
      experienceLevel: "senior",
      educationRequirement: "bachelors",
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
      location: "Remote",
      isRemote: true,
      requiredSkills: ["TypeScript", "Node.js"],
      preferredSkills: [],
      descriptionMd: "Job description",
      descriptionPlain: "Job description",
      status: "published",
      biasCheckStatus: "passed",
      biasFlags: [],
      publishedAt: new Date("2026-05-01T00:00:00Z"),
      closedAt: null,
      filledAt: null,
      hiringManagerId: null,
      ownerId: companyId,
      viewCount: 0,
      createdAt: new Date("2026-05-01T00:00:00Z"),
      updatedAt: new Date("2026-05-01T00:00:00Z"),
    } as unknown as Job;
  }

  function buildScoringConfig(): ScoringConfig {
    return {
      id: "55555555-5555-5555-5555-555555555555",
      profileWeights: {
        completeness: 25,
        skill_depth: 25,
        experience_clarity: 25,
        education_quality: 25,
      } as unknown as Record<string, unknown>,
      matchWeights: {
        skills: 40,
        experience: 30,
        education: 15,
        cultural_fit: 15,
      } as unknown as Record<string, unknown>,
      bandThresholds: { strong: 70, partial: 40 } as unknown as Record<
        string,
        unknown
      >,
      isActive: true,
      createdAt: new Date("2026-04-01T00:00:00Z"),
      updatedAt: new Date("2026-04-01T00:00:00Z"),
    } as unknown as ScoringConfig;
  }

  function buildAiResult() {
    return {
      score: {
        overall_score: 78,
        band: "strong" as const,
        components: [
          {
            name: "skills",
            score: 32,
            max: 40,
            weight: 40,
            explanation: "Strong skill match",
            evidence: [
              {
                excerpt: "TypeScript, Node.js",
                source: "skills",
                relevance: "high" as const,
                contribution_points: 8,
              },
            ],
          },
          {
            name: "experience",
            score: 24,
            max: 30,
            weight: 30,
            explanation: "Senior-level experience",
            evidence: [],
          },
          {
            name: "education",
            score: 12,
            max: 15,
            weight: 15,
            explanation: "Bachelor's degree",
            evidence: [],
          },
          {
            name: "cultural_fit",
            score: 10,
            max: 15,
            weight: 15,
            explanation: "Decent fit",
            evidence: [],
          },
        ],
        summary: "Strong match",
        red_flags: null,
        green_flags: null,
      },
      redactedFields: ["email", "phone"],
      promptVersion: "score-match@v1",
      model: "gpt-4o-mini",
      latencyMs: 1234,
    };
  }

  function buildPreviewRow(
    overrides: Partial<MatchScorePreview> = {},
  ): MatchScorePreview {
    return {
      id: "66666666-6666-6666-6666-666666666666",
      candidateId,
      jobId,
      resumeId,
      overallScore: 78,
      band: "strong",
      components: buildAiResult().score.components as unknown as Record<
        string,
        unknown
      >,
      redactedFields: ["email", "phone"],
      weightsUsed: {
        skills: 40,
        experience: 30,
        education: 15,
        cultural_fit: 15,
      } as unknown as Record<string, unknown>,
      promptVersion: "score-match@v1",
      modelUsed: "gpt-4o-mini",
      rawOutput: buildAiResult().score as unknown as Record<string, unknown>,
      latencyMs: 1234,
      source: "candidate_view",
      createdAt: new Date("2026-05-08T12:00:00Z"),
      ...overrides,
    } as MatchScorePreview;
  }

  /**
   * Tiny in-memory Redis stub that mimics the subset of ioredis methods the
   * on-view path uses (`incr`, `expire`, `get`, `set`). We use a real-ish
   * counter so tests can verify "did the counter advance?" without standing
   * up a Redis container.
   */
  function buildRedisStub() {
    const store = new Map<string, string>();
    const expiries = new Map<string, number>();
    const stub = {
      incr: jest.fn(async (key: string) => {
        const current = Number(store.get(key) ?? "0");
        const next = current + 1;
        store.set(key, String(next));
        return next;
      }),
      expire: jest.fn(async (key: string, ttlSeconds: number) => {
        expiries.set(key, ttlSeconds);
        return 1;
      }),
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      set: jest.fn(async (key: string, value: string | number) => {
        store.set(key, String(value));
        return "OK";
      }),
    } as unknown as jest.Mocked<Redis> & {
      _store: Map<string, string>;
      _expiries: Map<string, number>;
    };
    Object.assign(stub, { _store: store, _expiries: expiries });
    return stub;
  }

  function buildSvc(opts: { existingPreview?: MatchScorePreview | null } = {}) {
    const redis = buildRedisStub();

    const scoringRepo = {
      findMatchPreview: jest.fn(async () => opts.existingPreview ?? null),
      upsertMatchPreview: jest.fn(async (data: Record<string, unknown>) =>
        buildPreviewRow({
          overallScore: data.overallScore as number,
          band: data.band as MatchScorePreview["band"],
          source: data.source as MatchScorePreview["source"],
        }),
      ),
      getActiveConfig: jest.fn(async () => buildScoringConfig()),
    } as unknown as jest.Mocked<ScoringRepository>;

    const resumesRepo = {
      findDefaultByCandidateId: jest.fn(async () => buildResume()),
    } as unknown as jest.Mocked<ResumesRepository>;

    const jobsRepo = {
      findById: jest.fn(async () => buildJob()),
    } as unknown as jest.Mocked<JobsRepository>;

    const profilesRepo = {} as unknown as jest.Mocked<ProfilesRepository>;
    const scoreProfile = {} as unknown as jest.Mocked<ScoreProfileService>;
    const scoreMatch = {
      score: jest.fn(async () => buildAiResult()),
    } as unknown as jest.Mocked<ScoreMatchService>;

    const audit = {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;

    const cacheService = {
      getOrSet: jest.fn(),
      bustTag: jest.fn(),
      bustTags: jest.fn(),
      bustKey: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;

    const events = {
      emitMatchPreviewCreated: jest.fn(),
      emitProfileScoreUpdated: jest.fn(),
    } as unknown as jest.Mocked<EventsService>;

    const svc = new ScoringService(
      scoreProfile,
      scoreMatch,
      jobsRepo,
      profilesRepo,
      resumesRepo,
      scoringRepo,
      audit,
      cacheService,
      redis,
      events,
    );
    return {
      svc,
      redis,
      scoringRepo,
      resumesRepo,
      jobsRepo,
      scoreMatch,
      audit,
      events,
    };
  }

  it("writes preview row with source = 'candidate_view' and increments redis counter", async () => {
    const { svc, redis, scoringRepo, scoreMatch } = buildSvc();

    const result = await svc.computeMatchPreviewOnView(
      buildCandidateUser(),
      jobId,
    );

    // Source tag and clamped overall score
    expect(result.source).toBe("candidate_view");
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);

    // Counter incremented exactly once with TTL set on first hit
    expect(redis.incr).toHaveBeenCalledTimes(1);
    expect(redis.incr).toHaveBeenCalledWith(counterKey());
    expect(redis.expire).toHaveBeenCalledTimes(1);
    expect(redis.expire).toHaveBeenCalledWith(counterKey(), 90_000);
    const count = Number(await redis.get(counterKey()));
    expect(count).toBe(1);

    // AI compute happened, and the preview was upserted with the right source
    expect(scoreMatch.score).toHaveBeenCalledTimes(1);
    expect(scoringRepo.upsertMatchPreview).toHaveBeenCalledTimes(1);
    const upsertArgs = (scoringRepo.upsertMatchPreview as jest.Mock).mock
      .calls[0][0];
    expect(upsertArgs.source).toBe("candidate_view");
    expect(upsertArgs.candidateId).toBe(candidateId);
    expect(upsertArgs.jobId).toBe(jobId);
    expect(upsertArgs.resumeId).toBe(resumeId);
  });

  it("returns cached preview without incrementing counter on cache hit", async () => {
    const { svc, redis, scoringRepo, scoreMatch } = buildSvc({
      existingPreview: buildPreviewRow(),
    });

    const result = await svc.computeMatchPreviewOnView(
      buildCandidateUser(),
      jobId,
    );

    // Cache hit short-circuit: no Redis INCR, no AI call, no upsert
    expect(redis.incr).not.toHaveBeenCalled();
    expect(redis.expire).not.toHaveBeenCalled();
    expect(scoreMatch.score).not.toHaveBeenCalled();
    expect(scoringRepo.upsertMatchPreview).not.toHaveBeenCalled();

    expect(result).toBeDefined();
    expect(result.id).toBe("66666666-6666-6666-6666-666666666666");
    // Counter is empty (never touched)
    expect(await redis.get(counterKey())).toBeNull();
  });

  it("throws 429 with code DAILY_AI_LIMIT when cap exceeded", async () => {
    const { svc, redis, scoringRepo, scoreMatch } = buildSvc();

    // Pre-load the counter to exactly the cap; the next INCR pushes us over.
    await redis.set(counterKey(), ONVIEW_DAILY_CAP);

    await expect(
      svc.computeMatchPreviewOnView(buildCandidateUser(), jobId),
    ).rejects.toMatchObject({
      response: { code: "DAILY_AI_LIMIT", cap: ONVIEW_DAILY_CAP },
    });

    // The increment happened (so subsequent calls keep failing fast) but
    // we never reached the AI call or the DB write.
    expect(redis.incr).toHaveBeenCalledTimes(1);
    expect(scoreMatch.score).not.toHaveBeenCalled();
    expect(scoringRepo.upsertMatchPreview).not.toHaveBeenCalled();
  });

  it("emits match-preview.created with the candidate, job, resume, and source", async () => {
    const { svc, events } = buildSvc();

    await svc.computeMatchPreviewOnView(buildCandidateUser(), jobId);

    expect(events.emitMatchPreviewCreated).toHaveBeenCalledTimes(1);
    expect(events.emitMatchPreviewCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId,
        jobId,
        resumeId,
        source: "candidate_view",
        band: expect.any(String),
        overallScore: expect.any(Number),
        createdAt: expect.any(String),
      }),
    );
  });

  it("does NOT emit match-preview.created on cache hit", async () => {
    const { svc, events } = buildSvc({ existingPreview: buildPreviewRow() });

    await svc.computeMatchPreviewOnView(buildCandidateUser(), jobId);

    expect(events.emitMatchPreviewCreated).not.toHaveBeenCalled();
  });

  it("throws ForbiddenException when caller is not a candidate", async () => {
    const { svc, redis, scoringRepo, scoreMatch, resumesRepo } = buildSvc();

    await expect(
      svc.computeMatchPreviewOnView(
        buildCandidateUser({ role: "recruiter" }),
        jobId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Role check fails fast - nothing downstream runs.
    expect(resumesRepo.findDefaultByCandidateId).not.toHaveBeenCalled();
    expect(redis.incr).not.toHaveBeenCalled();
    expect(scoreMatch.score).not.toHaveBeenCalled();
    expect(scoringRepo.upsertMatchPreview).not.toHaveBeenCalled();
  });
});

describe("ScoringService.computeProfileScore", () => {
  const candidateId = "11111111-1111-1111-1111-111111111111";
  const resumeId = "33333333-3333-3333-3333-333333333333";
  const profileScoreId = "77777777-7777-7777-7777-777777777777";

  function buildResume(): Resume {
    return {
      id: resumeId,
      candidateId,
      filename: "resume.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1234,
      storagePath: `${candidateId}/source.pdf`,
      canonicalPdfPath: null,
      rawText: "raw text",
      parsedData: { parse_confidence: 0.9 } as Record<string, unknown>,
      parseStatus: "parsed",
      parseError: null,
      isDefault: true,
      createdAt: new Date("2026-05-08T00:00:00Z"),
      updatedAt: new Date("2026-05-08T00:00:00Z"),
    };
  }

  function buildScoringConfig(): ScoringConfig {
    return {
      id: "55555555-5555-5555-5555-555555555555",
      profileWeights: {
        completeness: 25,
        skill_depth: 25,
        experience_clarity: 25,
        education_quality: 25,
      } as unknown as Record<string, unknown>,
      matchWeights: {
        skills: 40,
        experience: 30,
        education: 15,
        cultural_fit: 15,
      } as unknown as Record<string, unknown>,
      bandThresholds: { strong: 70, partial: 40 } as unknown as Record<
        string,
        unknown
      >,
      isActive: true,
      createdAt: new Date("2026-04-01T00:00:00Z"),
      updatedAt: new Date("2026-04-01T00:00:00Z"),
    } as unknown as ScoringConfig;
  }

  function buildProfileAiResult() {
    return {
      score: {
        overall_score: 85,
        band: "strong" as const,
        components: [
          {
            name: "completeness",
            score: 22,
            max: 25,
            weight: 25,
            explanation: "Most fields present",
            evidence: [],
          },
          {
            name: "skill_depth",
            score: 21,
            max: 25,
            weight: 25,
            explanation: "Strong skills",
            evidence: [],
          },
          {
            name: "experience_clarity",
            score: 21,
            max: 25,
            weight: 25,
            explanation: "Clear experience",
            evidence: [],
          },
          {
            name: "education_quality",
            score: 21,
            max: 25,
            weight: 25,
            explanation: "Solid education",
            evidence: [],
          },
        ],
        improvement_suggestions: [],
      },
      redactedFields: ["email", "phone"],
      promptVersion: "score-profile@v1",
      model: "gpt-4o-mini",
      latencyMs: 1234,
    };
  }

  function buildSvc() {
    const scoringRepo = {
      findMostRecentProfileScore: jest.fn(async () => null),
      getActiveConfig: jest.fn(async () => buildScoringConfig()),
      insertProfileScore: jest.fn(async (data: Record<string, unknown>) => ({
        profileScore: {
          id: profileScoreId,
          candidateId: data.candidateId,
          resumeId: data.resumeId,
          overallScore: data.overallScore,
          band: data.band,
          createdAt: new Date("2026-05-08T12:00:00Z"),
        },
        evidence: [],
      })),
    } as unknown as jest.Mocked<ScoringRepository>;

    const resumesRepo = {
      findById: jest.fn(async () => buildResume()),
      findDefaultByCandidateId: jest.fn(async () => buildResume()),
    } as unknown as jest.Mocked<ResumesRepository>;

    const jobsRepo = {} as unknown as jest.Mocked<JobsRepository>;

    const profilesRepo = {
      findCandidateProfile: jest.fn(async () => ({
        id: candidateId,
        desiredRoles: ["Senior Engineer"],
        desiredSeniority: "Senior",
      })),
    } as unknown as jest.Mocked<ProfilesRepository>;

    const scoreProfile = {
      score: jest.fn(async () => buildProfileAiResult()),
    } as unknown as jest.Mocked<ScoreProfileService>;

    const scoreMatch = {} as unknown as jest.Mocked<ScoreMatchService>;

    const audit = {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;

    const cacheService = {
      getOrSet: jest.fn(),
      bustTag: jest.fn().mockResolvedValue(undefined),
      bustTags: jest.fn(),
      bustKey: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;

    const events = {
      emitMatchPreviewCreated: jest.fn(),
      emitProfileScoreUpdated: jest.fn(),
    } as unknown as jest.Mocked<EventsService>;

    const redis = {} as unknown as jest.Mocked<Redis>;

    const svc = new ScoringService(
      scoreProfile,
      scoreMatch,
      jobsRepo,
      profilesRepo,
      resumesRepo,
      scoringRepo,
      audit,
      cacheService,
      redis,
      events,
    );

    return { svc, events, scoringRepo };
  }

  it("emits profile-score.updated with the reason when called manually", async () => {
    const { svc, events } = buildSvc();

    await svc.computeProfileScore(candidateId, resumeId, {
      reason: "manual_recompute",
    });

    expect(events.emitProfileScoreUpdated).toHaveBeenCalledTimes(1);
    expect(events.emitProfileScoreUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId,
        resumeId,
        reason: "manual_recompute",
        band: expect.any(String),
        overallScore: expect.any(Number),
        updatedAt: expect.any(String),
      }),
    );
  });

  it("emits profile-score.updated with reason='onboarding' when caller passes that reason", async () => {
    const { svc, events } = buildSvc();

    await svc.computeProfileScore(candidateId, resumeId, {
      reason: "onboarding",
    });

    expect(events.emitProfileScoreUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "onboarding" }),
    );
  });

  it("emits profile-score.updated with reason='resume_change' when called by the recompute processor", async () => {
    const { svc, events } = buildSvc();

    await svc.computeProfileScore(candidateId, resumeId, {
      reason: "resume_change",
    });

    expect(events.emitProfileScoreUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "resume_change" }),
    );
  });
});
