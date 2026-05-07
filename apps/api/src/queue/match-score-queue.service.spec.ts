import { MatchScoreQueueService } from "./match-score-queue.service";

describe("MatchScoreQueueService.enqueue", () => {
  it("adds a job with id keyed by applicationId for idempotency", async () => {
    const add = jest.fn().mockResolvedValue({ id: "job-1" });
    const queue = { add } as never;
    const svc = new MatchScoreQueueService(queue);

    await svc.enqueue({
      applicationId: "00000000-0000-4000-8000-000000000001",
      candidateId: "00000000-0000-4000-8000-000000000002",
      jobId: "00000000-0000-4000-8000-000000000003",
      resumeId: "00000000-0000-4000-8000-000000000004",
    });

    expect(add).toHaveBeenCalledWith(
      "score",
      expect.objectContaining({
        applicationId: "00000000-0000-4000-8000-000000000001",
      }),
      expect.objectContaining({
        jobId: "score:00000000-0000-4000-8000-000000000001",
        attempts: 3,
      }),
    );
  });

  it("never throws when the queue rejects (best-effort enqueue)", async () => {
    const add = jest.fn().mockRejectedValue(new Error("redis down"));
    const queue = { add } as never;
    const svc = new MatchScoreQueueService(queue);

    await expect(
      svc.enqueue({
        applicationId: "00000000-0000-4000-8000-000000000001",
        candidateId: "00000000-0000-4000-8000-000000000002",
        jobId: "00000000-0000-4000-8000-000000000003",
        resumeId: "00000000-0000-4000-8000-000000000004",
      }),
    ).resolves.toBeUndefined();
  });
});
