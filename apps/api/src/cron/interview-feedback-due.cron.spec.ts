import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";

import { InterviewFeedbackDueCron } from "./interview-feedback-due.cron";
import { DRIZZLE_CLIENT } from "../db/db.module";
import { NotificationsService } from "../modules/notifications/notifications.service";
import { AuditService } from "../audit";

jest.mock("jose", () => ({}));

interface DueRow {
  interviewId: string;
  recruiterId: string;
  candidateName: string;
  jobTitle: string;
}

function makeDb(dueRows: DueRow[]) {
  const update = jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
  });
  const limitFn = jest.fn().mockResolvedValue(dueRows);
  const whereFn = jest.fn().mockReturnValue({ limit: limitFn });
  const innerJoinFn = jest.fn();
  innerJoinFn.mockReturnValue({ innerJoin: innerJoinFn, where: whereFn });
  const fromFn = jest.fn().mockReturnValue({ innerJoin: innerJoinFn });
  const selectFn = jest.fn().mockReturnValue({ from: fromFn });
  return { select: selectFn, update };
}

describe("InterviewFeedbackDueCron", () => {
  let cron: InterviewFeedbackDueCron;
  let notifications: any;
  let audit: any;

  async function setup(dueRows: DueRow[]) {
    const db = makeDb(dueRows);
    notifications = { emit: jest.fn() };
    audit = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        InterviewFeedbackDueCron,
        { provide: DRIZZLE_CLIENT, useValue: db },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditService, useValue: audit },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();
    cron = moduleRef.get(InterviewFeedbackDueCron);
    return { db };
  }

  it("emits feedback-due notification and marks the dedup flag for each due row", async () => {
    const due: DueRow[] = [
      {
        interviewId: "i1",
        recruiterId: "r1",
        candidateName: "Alex",
        jobTitle: "Engineer",
      },
      {
        interviewId: "i2",
        recruiterId: "r2",
        candidateName: "Bo",
        jobTitle: "PM",
      },
    ];
    const { db } = await setup(due);

    const result = await cron.execute();
    expect(notifications.emit).toHaveBeenCalledTimes(2);
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "r1",
        eventType: "interview_feedback_due",
        entityType: "interview",
        entityId: "i1",
        metadata: expect.objectContaining({
          interviewId: "i1",
          candidateName: "Alex",
          jobTitle: "Engineer",
        }),
      }),
    );
    expect(db.update).toHaveBeenCalledTimes(2);
    expect(result.notified).toBe(2);
  });

  it("audit-logs the run with notified and scanned counts", async () => {
    await setup([
      {
        interviewId: "i1",
        recruiterId: "r1",
        candidateName: "X",
        jobTitle: "T",
      },
    ]);
    await cron.execute();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: "system",
        action: expect.stringContaining("interview_feedback_due.executed"),
        details: expect.objectContaining({ notified: 1, scanned: 1 }),
      }),
    );
  });

  it("idempotent: empty due set is a no-op apart from audit", async () => {
    await setup([]);
    const result = await cron.execute();
    expect(notifications.emit).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(result.notified).toBe(0);
  });

  it("continues processing other rows when one notification.emit fails", async () => {
    const due: DueRow[] = [
      {
        interviewId: "i1",
        recruiterId: "r1",
        candidateName: "X",
        jobTitle: "T",
      },
      {
        interviewId: "i2",
        recruiterId: "r2",
        candidateName: "Y",
        jobTitle: "T",
      },
    ];
    const { db } = await setup(due);
    notifications.emit
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(undefined);
    const result = await cron.execute();
    expect(notifications.emit).toHaveBeenCalledTimes(2);
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(result.notified).toBe(1);
  });
});
