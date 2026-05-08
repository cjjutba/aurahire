import { Test } from "@nestjs/testing";
import type { Job } from "bullmq";

import { ScoringService } from "../scoring.service";
import { ProfileScoreRecomputeProcessor } from "./profile-score-recompute.processor";
import type { ProfileScoreRecomputePayload } from "../../../queue/profile-score-queue.service";

const candidateId = "11111111-1111-1111-1111-111111111111";
const resumeId = "22222222-2222-2222-2222-222222222222";

const buildJob = (
  data: ProfileScoreRecomputePayload,
  id = "job-1",
): Job<ProfileScoreRecomputePayload> =>
  ({
    id,
    name: "recompute",
    data,
  }) as unknown as Job<ProfileScoreRecomputePayload>;

const dtoFixture = {
  id: "score-1",
  overallScore: 78,
  band: "strong" as const,
  components: [],
  improvementSuggestions: [],
  redactedFields: [],
  promptVersion: "score-profile@v1",
  modelUsed: "gpt-4o-mini",
  latencyMs: 1234,
  createdAt: new Date().toISOString(),
};

describe("ProfileScoreRecomputeProcessor", () => {
  let processor: ProfileScoreRecomputeProcessor;
  let scoring: jest.Mocked<Pick<ScoringService, "computeProfileScore">>;

  beforeEach(async () => {
    scoring = {
      computeProfileScore: jest.fn().mockResolvedValue(dtoFixture),
    } as unknown as jest.Mocked<Pick<ScoringService, "computeProfileScore">>;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProfileScoreRecomputeProcessor,
        { provide: ScoringService, useValue: scoring },
      ],
    }).compile();

    processor = moduleRef.get(ProfileScoreRecomputeProcessor);
  });

  it("delegates to ScoringService.computeProfileScore with candidate, resume, and reason", async () => {
    await processor.process(
      buildJob({ candidateId, resumeId, reason: "profile_change" }),
    );

    expect(scoring.computeProfileScore).toHaveBeenCalledTimes(1);
    expect(scoring.computeProfileScore).toHaveBeenCalledWith(
      candidateId,
      resumeId,
      expect.objectContaining({ reason: "profile_change" }),
    );
  });

  it("forwards each recompute reason verbatim to the scoring service", async () => {
    const reasons = [
      "resume_change",
      "preferences_change",
      "profile_change",
      "manual_recompute",
    ] as const;

    for (const reason of reasons) {
      await processor.process(buildJob({ candidateId, resumeId, reason }));
    }

    expect(scoring.computeProfileScore).toHaveBeenCalledTimes(reasons.length);
    reasons.forEach((reason, idx) => {
      expect(scoring.computeProfileScore.mock.calls[idx]).toEqual([
        candidateId,
        resumeId,
        expect.objectContaining({ reason }),
      ]);
    });
  });

  it("re-throws AI/scoring errors so BullMQ can retry per its retry config", async () => {
    const failure = new Error("simulated AI failure");
    scoring.computeProfileScore.mockRejectedValueOnce(failure);

    // Silence the expected error log during this test so the suite stays clean.
    const errorSpy = jest
      .spyOn(processor["logger"], "error")
      .mockImplementation(() => undefined);

    await expect(
      processor.process(
        buildJob({ candidateId, resumeId, reason: "manual_recompute" }),
      ),
    ).rejects.toBe(failure);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining("simulated AI failure"),
    );

    errorSpy.mockRestore();
  });
});
