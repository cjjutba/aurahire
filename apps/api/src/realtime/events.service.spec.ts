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

describe("EventsService — proactive system events", () => {
  function makeService() {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    const gateway = { server: { to } } as never;
    const svc = new EventsService(gateway);
    return { svc, to, emit };
  }

  it("emitMatchPreviewCreated broadcasts to candidate user room", async () => {
    const { svc, to, emit } = makeService();
    const payload = {
      candidateId: "11111111-1111-4111-8111-111111111111",
      jobId: "22222222-2222-4222-8222-222222222222",
      resumeId: "33333333-3333-4333-8333-333333333333",
      source: "candidate_view" as const,
      overallScore: 85,
      band: "strong" as const,
      createdAt: "2026-05-08T12:00:00.000Z",
    };

    svc.emitMatchPreviewCreated(payload);

    await flush();
    expect(to).toHaveBeenCalledWith([
      "user:11111111-1111-4111-8111-111111111111",
    ]);
    expect(emit).toHaveBeenCalledWith("match-preview.created", payload);
  });

  it("emitProfileScoreUpdated broadcasts to candidate user room", async () => {
    const { svc, to, emit } = makeService();
    const payload = {
      candidateId: "11111111-1111-4111-8111-111111111111",
      resumeId: "33333333-3333-4333-8333-333333333333",
      overallScore: 72,
      band: "strong" as const,
      reason: "resume_change" as const,
      updatedAt: "2026-05-08T12:00:00.000Z",
    };

    svc.emitProfileScoreUpdated(payload);

    await flush();
    expect(to).toHaveBeenCalledWith([
      "user:11111111-1111-4111-8111-111111111111",
    ]);
    expect(emit).toHaveBeenCalledWith("profile-score.updated", payload);
  });

  it("emitNotificationCreated broadcasts to recipient user room", async () => {
    const { svc, to, emit } = makeService();
    const payload = {
      id: "44444444-4444-4444-8444-444444444444",
      userId: "55555555-5555-4555-8555-555555555555",
      kind: "application_status_changed",
      title: "Your application moved to Screening",
      bodyExcerpt: "The recruiter advanced your application.",
      linkUrl: "/candidate/applications/abc",
      createdAt: "2026-05-08T12:00:00.000Z",
      unreadCount: 3,
    };

    svc.emitNotificationCreated(payload);

    await flush();
    expect(to).toHaveBeenCalledWith([
      "user:55555555-5555-4555-8555-555555555555",
    ]);
    expect(emit).toHaveBeenCalledWith("notification.created", payload);
  });

  it("emitNotificationRead broadcasts to the supplied user room", async () => {
    const { svc, to, emit } = makeService();
    const userId = "55555555-5555-4555-8555-555555555555";
    const payload = {
      id: "44444444-4444-4444-8444-444444444444",
      unreadCount: 2,
    };

    svc.emitNotificationRead(userId, payload);

    await flush();
    expect(to).toHaveBeenCalledWith([
      "user:55555555-5555-4555-8555-555555555555",
    ]);
    expect(emit).toHaveBeenCalledWith("notification.read", payload);
  });

  it("emitNotificationArchived broadcasts to the supplied user room", async () => {
    const { svc, to, emit } = makeService();
    const userId = "55555555-5555-4555-8555-555555555555";
    const payload = {
      id: "44444444-4444-4444-8444-444444444444",
      unreadCount: 1,
    };

    svc.emitNotificationArchived(userId, payload);

    await flush();
    expect(to).toHaveBeenCalledWith([
      "user:55555555-5555-4555-8555-555555555555",
    ]);
    expect(emit).toHaveBeenCalledWith("notification.archived", payload);
  });

  it("emitNotificationArchiveAll broadcasts to the supplied user room with zero unread", async () => {
    const { svc, to, emit } = makeService();
    const userId = "55555555-5555-4555-8555-555555555555";
    const payload = { unreadCount: 0 as const };

    svc.emitNotificationArchiveAll(userId, payload);

    await flush();
    expect(to).toHaveBeenCalledWith([
      "user:55555555-5555-4555-8555-555555555555",
    ]);
    expect(emit).toHaveBeenCalledWith("notification.archive_all", payload);
  });
});
