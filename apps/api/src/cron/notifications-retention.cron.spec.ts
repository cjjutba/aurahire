import { Test } from "@nestjs/testing";

import { NotificationsRetentionCron } from "./notifications-retention.cron";
import { NotificationsRepository } from "../modules/notifications/notifications.repository";
import { AuditService } from "../audit";

jest.mock("jose", () => ({}));

describe("NotificationsRetentionCron", () => {
  let cron: NotificationsRetentionCron;
  let repo: any;
  let audit: any;

  beforeEach(async () => {
    repo = { deleteOlderThan: jest.fn().mockResolvedValue(42) };
    audit = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsRetentionCron,
        { provide: NotificationsRepository, useValue: repo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    cron = moduleRef.get(NotificationsRetentionCron);
  });

  it("calls deleteOlderThan with a 90-day cutoff (within +/- 1 day tolerance)", async () => {
    await cron.execute();
    expect(repo.deleteOlderThan).toHaveBeenCalledTimes(1);
    const cutoff = repo.deleteOlderThan.mock.calls[0][0] as Date;
    const elapsed = Date.now() - cutoff.getTime();
    expect(elapsed).toBeGreaterThanOrEqual(89 * 24 * 60 * 60 * 1000);
    expect(elapsed).toBeLessThanOrEqual(91 * 24 * 60 * 60 * 1000);
  });

  it("audit-logs the deleted count and cutoff", async () => {
    const result = await cron.execute();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        actorType: "system",
        action: expect.stringContaining("notifications.retention_run"),
        details: expect.objectContaining({ deleted: 42 }),
      }),
    );
    expect(result.deleted).toBe(42);
  });

  it("idempotent: zero deleted rows is a clean run", async () => {
    repo.deleteOlderThan.mockResolvedValue(0);
    const result = await cron.execute();
    expect(result.deleted).toBe(0);
    expect(audit.log).toHaveBeenCalledTimes(1);
  });
});
