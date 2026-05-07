import { Test } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import { NotificationsService } from "./notifications.service";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationPreferencesService } from "../notification-preferences/notification-preferences.service";
import { NOTIFICATION_EMAIL_QUEUE } from "./queues";
import { ProfilesRepository } from "../profiles/profiles.repository";

const mockRepo = () => ({
  insertOne: jest.fn(),
  insertMany: jest.fn(),
  setDigestPending: jest.fn(),
});
const mockPrefs = () => ({ getEffectiveMode: jest.fn() });
const mockQueue = () => ({ add: jest.fn() });
const mockProfiles = () => ({ findById: jest.fn() });

describe("NotificationsService.emit", () => {
  let service: NotificationsService;
  let repo: ReturnType<typeof mockRepo>;
  let prefs: ReturnType<typeof mockPrefs>;
  let queue: ReturnType<typeof mockQueue>;
  let profiles: ReturnType<typeof mockProfiles>;

  beforeEach(async () => {
    repo = mockRepo();
    prefs = mockPrefs();
    queue = mockQueue();
    profiles = mockProfiles();

    profiles.findById.mockResolvedValue({ id: "u1", status: "active", role: "candidate" });

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: repo },
        { provide: NotificationPreferencesService, useValue: prefs },
        { provide: getQueueToken(NOTIFICATION_EMAIL_QUEUE), useValue: queue },
        { provide: ProfilesRepository, useValue: profiles },
        Logger,
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);
    repo.insertOne.mockResolvedValue({ id: "n1", userId: "u1" });
  });

  it("inserts a row and enqueues an email job when mode is 'instant'", async () => {
    prefs.getEffectiveMode.mockResolvedValue("instant");
    await service.emit({
      userId: "u1",
      eventType: "application_status_changed",
      entityType: "application",
      entityId: "app1",
      metadata: { newStatus: "interview" },
    });
    expect(repo.insertOne).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      "instant-email",
      { kind: "instant", notificationId: "n1" },
      expect.any(Object),
    );
    expect(repo.setDigestPending).not.toHaveBeenCalled();
  });

  it("marks digest_pending and skips queue when mode is 'digest'", async () => {
    prefs.getEffectiveMode.mockResolvedValue("digest");
    await service.emit({
      userId: "u1",
      eventType: "new_application_received",
    });
    expect(repo.insertOne).toHaveBeenCalled();
    expect(repo.setDigestPending).toHaveBeenCalledWith("n1", true);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("inserts but does not enqueue or mark digest when mode is 'off'", async () => {
    prefs.getEffectiveMode.mockResolvedValue("off");
    await service.emit({ userId: "u1", eventType: "team_invite_accepted" });
    expect(repo.insertOne).toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
    expect(repo.setDigestPending).not.toHaveBeenCalled();
  });

  it("ignores preferences for SECURITY_EVENTS and always sends instant", async () => {
    prefs.getEffectiveMode.mockResolvedValue("off");
    await service.emit({ userId: "u1", eventType: "account_password_reset" });
    expect(queue.add).toHaveBeenCalled();
  });

  it("does not insert a row when userId === actorId (self-targeting)", async () => {
    await service.emit({
      userId: "u1",
      actorId: "u1",
      eventType: "application_status_changed",
    });
    expect(repo.insertOne).not.toHaveBeenCalled();
  });

  it("does not insert a row for suspended users", async () => {
    profiles.findById.mockResolvedValue({ id: "u1", status: "suspended", role: "candidate" });
    await service.emit({ userId: "u1", eventType: "application_status_changed" });
    expect(repo.insertOne).not.toHaveBeenCalled();
  });

  it("does not insert a row when profile is null", async () => {
    profiles.findById.mockResolvedValue(null);
    await service.emit({ userId: "u1", eventType: "application_status_changed" });
    expect(repo.insertOne).not.toHaveBeenCalled();
  });

  it("swallows errors and never throws", async () => {
    repo.insertOne.mockRejectedValue(new Error("boom"));
    prefs.getEffectiveMode.mockResolvedValue("instant");
    await expect(
      service.emit({ userId: "u1", eventType: "application_status_changed" }),
    ).resolves.toBeUndefined();
  });

  it("emitMany fans out to all user ids", async () => {
    profiles.findById.mockResolvedValue({ id: "x", status: "active", role: "admin" });
    prefs.getEffectiveMode.mockResolvedValue("instant");
    await service.emitMany(["a", "b", "c"], {
      eventType: "system_bias_flag_raised",
      scope: "system",
    });
    expect(repo.insertOne).toHaveBeenCalledTimes(3);
  });
});
