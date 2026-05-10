import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";

import { DigestEmailCron } from "./digest-email.cron";
import { NotificationsRepository } from "../modules/notifications/notifications.repository";
import { NOTIFICATION_EMAIL_QUEUE } from "../modules/notifications/queues";
import { AuditService } from "../audit";

// Pre-existing pattern: AuditService transitively imports jose (ESM); mock it.
jest.mock("jose", () => ({}));

describe("DigestEmailCron", () => {
  let cron: DigestEmailCron;
  let repo: any;
  let queue: any;
  let audit: any;

  beforeEach(async () => {
    repo = {
      findDigestPendingByUser: jest.fn(),
      clearDigestPending: jest.fn(),
    };
    queue = { add: jest.fn() };
    audit = { log: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DigestEmailCron,
        { provide: NotificationsRepository, useValue: repo },
        { provide: getQueueToken(NOTIFICATION_EMAIL_QUEUE), useValue: queue },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    cron = moduleRef.get(DigestEmailCron);
  });

  it("enqueues one digest job per user and clears digest_pending for each batch", async () => {
    repo.findDigestPendingByUser.mockResolvedValue([
      { userId: "u1", ids: ["n1", "n2"] },
      { userId: "u2", ids: ["n3"] },
    ]);
    const result = await cron.execute();
    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(repo.clearDigestPending).toHaveBeenCalledWith(["n1", "n2"]);
    expect(repo.clearDigestPending).toHaveBeenCalledWith(["n3"]);
    expect(result.userCount).toBe(2);
    expect(result.notificationCount).toBe(3);
  });

  it("audit-logs the batch run with totals", async () => {
    repo.findDigestPendingByUser.mockResolvedValue([
      { userId: "u1", ids: ["n1"] },
    ]);
    await cron.execute();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        actorType: "system",
        action: expect.stringContaining("digest_email_batch_run"),
        details: expect.objectContaining({
          userCount: 1,
          notificationCount: 1,
        }),
      }),
    );
  });

  it("idempotent: empty pending set produces no enqueue but still audits", async () => {
    repo.findDigestPendingByUser.mockResolvedValue([]);
    const result = await cron.execute();
    expect(queue.add).not.toHaveBeenCalled();
    expect(repo.clearDigestPending).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(result.userCount).toBe(0);
  });

  it("continues processing other batches when one batch's enqueue fails", async () => {
    repo.findDigestPendingByUser.mockResolvedValue([
      { userId: "u1", ids: ["n1"] },
      { userId: "u2", ids: ["n2"] },
    ]);
    queue.add
      .mockRejectedValueOnce(new Error("redis down"))
      .mockResolvedValue(undefined);
    const result = await cron.execute();
    // Both batches attempted
    expect(queue.add).toHaveBeenCalledTimes(2);
    // Only the second batch's clearDigestPending fired (the first errored)
    expect(repo.clearDigestPending).toHaveBeenCalledTimes(1);
    expect(repo.clearDigestPending).toHaveBeenCalledWith(["n2"]);
    // notificationCount counts only successful batches
    expect(result.notificationCount).toBe(1);
  });
});
