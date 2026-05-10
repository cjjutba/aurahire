import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";

import { OfferExpiryReminderCron } from "./offer-expiry-reminder.cron";
import { DRIZZLE_CLIENT } from "../db/db.module";
import { NotificationsService } from "../modules/notifications/notifications.service";
import { AuditService } from "../audit";

jest.mock("jose", () => ({}));

interface DueRow {
  offerId: string;
  applicationId: string;
  expiresAt: Date;
  candidateId: string;
  jobTitle: string;
  companyName: string;
}

function makeDb(dueRows: DueRow[]) {
  const update = jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
  });
  // Drizzle .select().from().innerJoin().innerJoin().innerJoin().where().limit() returns a Promise
  const limitFn = jest.fn().mockResolvedValue(dueRows);
  const whereFn = jest.fn().mockReturnValue({ limit: limitFn });
  const innerJoinFn = jest.fn();
  innerJoinFn.mockReturnValue({ innerJoin: innerJoinFn, where: whereFn });
  const fromFn = jest.fn().mockReturnValue({ innerJoin: innerJoinFn });
  const selectFn = jest.fn().mockReturnValue({ from: fromFn });
  return { select: selectFn, update };
}

describe("OfferExpiryReminderCron", () => {
  let cron: OfferExpiryReminderCron;
  let notifications: jest.Mocked<Pick<NotificationsService, "emit">>;
  let audit: jest.Mocked<Pick<AuditService, "log">>;

  async function setup(dueRows: DueRow[]) {
    const db = makeDb(dueRows);
    notifications = { emit: jest.fn() };
    audit = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        OfferExpiryReminderCron,
        { provide: DRIZZLE_CLIENT, useValue: db },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditService, useValue: audit },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();
    cron = moduleRef.get(OfferExpiryReminderCron);
    return { db };
  }

  it("emits a reminder and marks expiry_reminder_sent_at for each due row", async () => {
    const due: DueRow[] = [
      {
        offerId: "o1",
        applicationId: "a1",
        expiresAt: new Date(),
        candidateId: "c1",
        jobTitle: "Engineer",
        companyName: "ACME",
      },
      {
        offerId: "o2",
        applicationId: "a2",
        expiresAt: new Date(),
        candidateId: "c2",
        jobTitle: "PM",
        companyName: "ACME",
      },
    ];
    const { db } = await setup(due);

    const result = await cron.execute();

    expect(notifications.emit).toHaveBeenCalledTimes(2);
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "c1",
        eventType: "offer_expiring_soon",
        entityType: "offer",
        entityId: "o1",
        metadata: expect.objectContaining({
          offerId: "o1",
          jobTitle: "Engineer",
          companyName: "ACME",
        }),
      }),
    );
    // Two expiryReminderSentAt updates fired
    expect(db.update).toHaveBeenCalledTimes(2);
    expect(result.remindersSent).toBe(2);
  });

  it("audit-logs the run with sent and scanned counts", async () => {
    await setup([
      {
        offerId: "o1",
        applicationId: "a1",
        expiresAt: new Date(),
        candidateId: "c1",
        jobTitle: "T",
        companyName: "C",
      },
    ]);
    await cron.execute();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: "system",
        action: expect.stringContaining("offer_expiry_reminder.executed"),
        details: expect.objectContaining({
          remindersSent: 1,
          candidatesScanned: 1,
        }),
      }),
    );
  });

  it("idempotent: empty due set is a no-op apart from the audit row", async () => {
    await setup([]);
    const result = await cron.execute();
    expect(notifications.emit).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(result.remindersSent).toBe(0);
  });

  it("continues processing other rows when one notification.emit fails", async () => {
    const due: DueRow[] = [
      {
        offerId: "o1",
        applicationId: "a1",
        expiresAt: new Date(),
        candidateId: "c1",
        jobTitle: "T",
        companyName: "C",
      },
      {
        offerId: "o2",
        applicationId: "a2",
        expiresAt: new Date(),
        candidateId: "c2",
        jobTitle: "T",
        companyName: "C",
      },
    ];
    const { db } = await setup(due);
    (notifications.emit as jest.Mock)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(undefined);
    const result = await cron.execute();
    expect(notifications.emit).toHaveBeenCalledTimes(2);
    expect(db.update).toHaveBeenCalledTimes(1); // only the second row's flag was set
    expect(result.remindersSent).toBe(1);
  });
});
