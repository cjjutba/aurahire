import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";

import { InterviewReminderCron } from "./interview-reminder.cron";
import { DRIZZLE_CLIENT } from "../db/db.module";
import { EmailService } from "../email/email.service";
import { NotificationsService } from "../modules/notifications/notifications.service";
import { AuditService } from "../audit";

jest.mock("jose", () => ({}));

interface DueRow {
  interviewId: string;
  applicationId: string;
  scheduledAt: Date;
  durationMinutes: number;
  format: string;
  venueName: string | null;
  addressLine: string | null;
  roomOrFloor: string | null;
  reportingInstructions: string | null;
  whatToBring: string | null;
  interviewerName: string | null;
  interviewerTitle: string | null;
  mapUrl: string | null;
  candidateId: string;
  candidateEmail: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  companyLogoUrl: string | null;
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

describe("InterviewReminderCron", () => {
  let cron: InterviewReminderCron;
  let notifications: jest.Mocked<Pick<NotificationsService, "emit">>;
  let audit: jest.Mocked<Pick<AuditService, "log">>;
  let emailSvc: jest.Mocked<Pick<EmailService, "send">>;

  async function setup(dueRows: DueRow[]) {
    const db = makeDb(dueRows);
    notifications = { emit: jest.fn() };
    audit = { log: jest.fn() };
    emailSvc = { send: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        InterviewReminderCron,
        { provide: DRIZZLE_CLIENT, useValue: db },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditService, useValue: audit },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: EmailService, useValue: emailSvc },
      ],
    }).compile();
    cron = moduleRef.get(InterviewReminderCron);
    return { db };
  }

  const makeRow = (overrides: Partial<DueRow> & Pick<DueRow, "interviewId" | "applicationId" | "candidateId" | "jobTitle" | "companyName">): DueRow => ({
    scheduledAt: new Date(),
    durationMinutes: 60,
    format: "video",
    venueName: null,
    addressLine: null,
    roomOrFloor: null,
    reportingInstructions: null,
    whatToBring: null,
    interviewerName: null,
    interviewerTitle: null,
    mapUrl: null,
    candidateEmail: `${overrides.candidateId ?? "c"}@example.com`,
    candidateName: "Test Candidate",
    companyLogoUrl: null,
    ...overrides,
  });

  it("emits a reminder and marks reminder_sent_at for each due row", async () => {
    const due: DueRow[] = [
      makeRow({ interviewId: "i1", applicationId: "a1", candidateId: "c1", jobTitle: "Engineer", companyName: "ACME", format: "video" }),
      makeRow({ interviewId: "i2", applicationId: "a2", candidateId: "c2", jobTitle: "PM", companyName: "ACME", format: "phone" }),
    ];
    const { db } = await setup(due);

    const result = await cron.execute();

    expect(notifications.emit).toHaveBeenCalledTimes(2);
    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "c1",
        eventType: "interview_reminder_24h",
        entityType: "interview",
        entityId: "i1",
        metadata: expect.objectContaining({
          interviewId: "i1",
          jobTitle: "Engineer",
          companyName: "ACME",
        }),
      }),
    );
    // Two reminderSentAt updates fired
    expect(db.update).toHaveBeenCalledTimes(2);
    expect(result.remindersSent).toBe(2);
  });

  it("audit-logs the run with sent and scanned counts", async () => {
    await setup([
      makeRow({ interviewId: "i1", applicationId: "a1", candidateId: "c1", jobTitle: "T", companyName: "C" }),
    ]);
    await cron.execute();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: "system",
        action: expect.stringContaining("interview_reminder.executed"),
        details: expect.objectContaining({ remindersSent: 1, candidatesScanned: 1 }),
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
      makeRow({ interviewId: "i1", applicationId: "a1", candidateId: "c1", jobTitle: "T", companyName: "C" }),
      makeRow({ interviewId: "i2", applicationId: "a2", candidateId: "c2", jobTitle: "T", companyName: "C" }),
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
