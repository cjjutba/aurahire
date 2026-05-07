import { EventsService } from "./events.service";

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("EventsService.emitApplicationScored", () => {
  it("broadcasts to candidate user room, recruiter room, and job room", async () => {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    const gateway = { server: { to } } as never;
    const svc = new EventsService(gateway);

    svc.emitApplicationScored({
      applicationId: "00000000-0000-4000-8000-000000000001",
      jobId: "00000000-0000-4000-8000-000000000002",
      recruiterId: "00000000-0000-4000-8000-000000000003",
      candidateId: "00000000-0000-4000-8000-000000000004",
      overallScore: 92,
      band: "strong",
      scoredAt: "2026-05-07T12:00:00.000Z",
    });

    await flush();
    expect(to).toHaveBeenCalledWith([
      "user:00000000-0000-4000-8000-000000000004",
      "recruiter:00000000-0000-4000-8000-000000000003",
      "job:00000000-0000-4000-8000-000000000002",
    ]);
    expect(emit).toHaveBeenCalledWith(
      "application.scored",
      expect.objectContaining({ overallScore: 92, band: "strong" }),
    );
  });

  it("silently drops when the gateway server is not initialized", async () => {
    const gateway = { server: undefined } as never;
    const svc = new EventsService(gateway);

    expect(() =>
      svc.emitApplicationScored({
        applicationId: "00000000-0000-4000-8000-000000000001",
        jobId: "00000000-0000-4000-8000-000000000002",
        recruiterId: "00000000-0000-4000-8000-000000000003",
        candidateId: "00000000-0000-4000-8000-000000000004",
        overallScore: 92,
        band: "strong",
        scoredAt: "2026-05-07T12:00:00.000Z",
      }),
    ).not.toThrow();
    await flush();
    // Test passes if no exception leaked through setImmediate.
  });
});
