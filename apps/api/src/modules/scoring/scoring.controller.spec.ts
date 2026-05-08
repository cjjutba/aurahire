// Mock jose (ESM-only) before any module in the chain loads it
jest.mock("jose", () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { Test } from "@nestjs/testing";
import type { AuthUser } from "@aurahire/shared";

import { ScoringController } from "./scoring.controller";
import { ScoringService } from "./scoring.service";
import { MatchPreviewRateLimitException } from "./dto/match-preview-rate-limit.exception";

const buildCandidate = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: "11111111-1111-1111-1111-111111111111",
  email: "candidate@example.com",
  role: "candidate",
  status: "active",
  fullName: "Test Candidate",
  profileCompleted: true,
  ...overrides,
});

describe("ScoringController.computeMatchPreview (POST match-preview/:jobId)", () => {
  const jobId = "22222222-2222-2222-2222-222222222222";
  let controller: ScoringController;
  let service: jest.Mocked<
    Pick<
      ScoringService,
      | "computeMatchPreview"
      | "computeMatchPreviewOnView"
      | "getMatchPreviewByJob"
      | "listMatchPreviewsForCandidate"
      | "computeProfileScore"
      | "computeProfileScoreForUser"
      | "getProfileScoreMe"
    >
  >;

  beforeEach(async () => {
    service = {
      computeMatchPreview: jest.fn(),
      computeMatchPreviewOnView: jest.fn(),
      getMatchPreviewByJob: jest.fn(),
      listMatchPreviewsForCandidate: jest.fn(),
      computeProfileScore: jest.fn(),
      computeProfileScoreForUser: jest.fn(),
      getProfileScoreMe: jest.fn(),
    } as unknown as typeof service;

    const moduleRef = await Test.createTestingModule({
      controllers: [ScoringController],
      providers: [{ provide: ScoringService, useValue: service }],
    }).compile();

    controller = moduleRef.get(ScoringController);
  });

  it("delegates POST /scoring/match-preview/:jobId to computeMatchPreviewOnView (not legacy computeMatchPreview)", async () => {
    const previewRow = {
      id: "66666666-6666-6666-6666-666666666666",
      jobId,
      resumeId: "33333333-3333-3333-3333-333333333333",
      overallScore: 78,
      band: "strong",
      components: [],
      redactedFields: [],
      promptVersion: "score-match@v1",
      modelUsed: "gpt-4o-mini",
      latencyMs: 1234,
      source: "candidate_view",
      createdAt: new Date().toISOString(),
      job: null,
    };
    (service.computeMatchPreviewOnView as jest.Mock).mockResolvedValue(previewRow);

    const user = buildCandidate();
    const result = await controller.computeMatchPreview(user, jobId);

    // The new on-view method gets called with (user, jobId) — and only that signature.
    expect(service.computeMatchPreviewOnView).toHaveBeenCalledTimes(1);
    expect(service.computeMatchPreviewOnView).toHaveBeenCalledWith(user, jobId);

    // The deprecated public method that writes source = 'candidate' must NOT be reached.
    expect(service.computeMatchPreview).not.toHaveBeenCalled();

    // Envelope shape preserved.
    expect(result).toEqual({ data: previewRow });
  });

  it("propagates 429 DAILY_AI_LIMIT from the on-view rate limiter", async () => {
    const cap = 100;
    (service.computeMatchPreviewOnView as jest.Mock).mockRejectedValue(
      new MatchPreviewRateLimitException(cap),
    );

    await expect(
      controller.computeMatchPreview(buildCandidate(), jobId),
    ).rejects.toMatchObject({
      response: { code: "DAILY_AI_LIMIT", cap },
      status: 429,
    });

    expect(service.computeMatchPreview).not.toHaveBeenCalled();
  });
});
