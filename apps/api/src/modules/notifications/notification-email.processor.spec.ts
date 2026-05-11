import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { NotificationEmailProcessor } from "./notification-email.processor";
import { NotificationsRepository } from "./notifications.repository";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { EmailService } from "../../email";

describe("NotificationEmailProcessor", () => {
  let processor: NotificationEmailProcessor;
  let repo: any;
  let profiles: any;
  let email: any;

  beforeEach(async () => {
    repo = {
      findById: jest.fn(),
      setEmailSent: jest.fn(),
    };
    profiles = {
      findById: jest.fn().mockResolvedValue({
        id: "u1",
        email: "u@x.io",
        role: "candidate",
        status: "active",
      }),
    };
    email = { send: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationEmailProcessor,
        { provide: NotificationsRepository, useValue: repo },
        { provide: ProfilesRepository, useValue: profiles },
        { provide: EmailService, useValue: email },
        {
          provide: ConfigService,
          useValue: { get: () => "http://localhost:3000" },
        },
      ],
    }).compile();
    processor = moduleRef.get(NotificationEmailProcessor);
  });

  it("instant: sends email and marks emailSentAt", async () => {
    repo.findById.mockResolvedValue({
      id: "n1",
      userId: "u1",
      eventType: "application_status_changed",
      title: "t",
      body: "b",
      link: "/x",
      metadata: { newStatus: "Interview" },
      emailSentAt: null,
      createdAt: new Date(),
    });
    await processor.process({
      data: { kind: "instant", notificationId: "n1" },
    } as any);
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(email.send.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        to: "u@x.io",
        subject: expect.stringContaining("application"),
      }),
    );
    expect(repo.setEmailSent).toHaveBeenCalledWith("n1");
  });

  it("instant: short-circuits when emailSentAt is set", async () => {
    repo.findById.mockResolvedValue({
      id: "n1",
      userId: "u1",
      eventType: "application_status_changed",
      emailSentAt: new Date(),
      metadata: {},
      createdAt: new Date(),
      title: "t",
      body: "b",
      link: null,
    });
    await processor.process({
      data: { kind: "instant", notificationId: "n1" },
    } as any);
    expect(email.send).not.toHaveBeenCalled();
    expect(repo.setEmailSent).not.toHaveBeenCalled();
  });

  it("instant: skips when notification row not found", async () => {
    repo.findById.mockResolvedValue(null);
    await processor.process({
      data: { kind: "instant", notificationId: "missing" },
    } as any);
    expect(email.send).not.toHaveBeenCalled();
    expect(repo.setEmailSent).not.toHaveBeenCalled();
  });

  it("instant: skips when profile not found", async () => {
    repo.findById.mockResolvedValue({
      id: "n1",
      userId: "u1",
      eventType: "application_status_changed",
      emailSentAt: null,
      metadata: {},
      createdAt: new Date(),
      title: "t",
      body: "b",
      link: "/x",
    });
    profiles.findById.mockResolvedValue(null);
    await processor.process({
      data: { kind: "instant", notificationId: "n1" },
    } as any);
    expect(email.send).not.toHaveBeenCalled();
    expect(repo.setEmailSent).not.toHaveBeenCalled();
  });

  it("digest: renders one email and marks every included row sent", async () => {
    const baseRow = {
      eventType: "application_status_changed" as const,
      title: "t",
      body: "b",
      link: "/x",
      metadata: {},
      createdAt: new Date(),
      emailSentAt: null,
      userId: "u1",
    };
    repo.findById
      .mockResolvedValueOnce({ ...baseRow, id: "n1" })
      .mockResolvedValueOnce({ ...baseRow, id: "n2" });
    await processor.process({
      data: { kind: "digest", userId: "u1", notificationIds: ["n1", "n2"] },
    } as any);
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(repo.setEmailSent).toHaveBeenCalledWith("n1");
    expect(repo.setEmailSent).toHaveBeenCalledWith("n2");
  });

  it("digest: skips entirely when profile is missing", async () => {
    profiles.findById.mockResolvedValue(null);
    await processor.process({
      data: { kind: "digest", userId: "u1", notificationIds: ["n1"] },
    } as any);
    expect(email.send).not.toHaveBeenCalled();
    expect(repo.setEmailSent).not.toHaveBeenCalled();
  });

  it("digest: skips when no valid rows are found (all null)", async () => {
    repo.findById.mockResolvedValue(null);
    await processor.process({
      data: { kind: "digest", userId: "u1", notificationIds: ["x", "y"] },
    } as any);
    expect(email.send).not.toHaveBeenCalled();
  });
});
