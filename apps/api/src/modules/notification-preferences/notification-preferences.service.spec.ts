import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { NotificationPreferencesService } from "./notification-preferences.service";
import { NotificationPreferencesRepository } from "./notification-preferences.repository";

const mockRepo = () => ({
  findOne: jest.fn(),
  findByUser: jest.fn(),
  upsert: jest.fn(),
  deleteForCategory: jest.fn(),
  deleteAllForUser: jest.fn(),
});

describe("NotificationPreferencesService", () => {
  let service: NotificationPreferencesService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    repo = mockRepo();
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationPreferencesService,
        { provide: NotificationPreferencesRepository, useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(NotificationPreferencesService);
  });

  describe("getEffectiveMode", () => {
    it("returns the stored mode when a row exists", async () => {
      repo.findOne.mockResolvedValue({ mode: "off" });
      const mode = await service.getEffectiveMode(
        "u1",
        "application_status_changed",
      );
      expect(mode).toBe("off");
    });

    it("falls back to DEFAULT_MODES when no row exists", async () => {
      repo.findOne.mockResolvedValue(null);
      const mode = await service.getEffectiveMode(
        "u1",
        "new_application_received",
      );
      expect(mode).toBe("digest");
    });

    it("always returns 'instant' for SECURITY_EVENTS regardless of stored row", async () => {
      repo.findOne.mockResolvedValue({ mode: "off" });
      const mode = await service.getEffectiveMode(
        "u1",
        "account_password_reset",
      );
      expect(mode).toBe("instant");
    });
  });

  describe("upsert", () => {
    it("rejects security event-types with BadRequest", async () => {
      await expect(
        service.upsert("u1", {
          eventType: "account_password_reset",
          mode: "off",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it("upserts non-security events", async () => {
      repo.upsert.mockResolvedValue({
        eventType: "application_status_changed",
        mode: "off",
      });
      await service.upsert("u1", {
        eventType: "application_status_changed",
        mode: "off",
      });
      expect(repo.upsert).toHaveBeenCalledWith(
        "u1",
        "application_status_changed",
        "off",
      );
    });
  });

  describe("listForRole", () => {
    it("returns one entry per role-visible event with isDefault flag", async () => {
      repo.findByUser.mockResolvedValue([
        { eventType: "application_status_changed", mode: "off" },
      ]);
      const list = await service.listForRole("u1", "candidate");
      const overridden = list.find(
        (x) => x.eventType === "application_status_changed",
      );
      expect(overridden?.mode).toBe("off");
      expect(overridden?.isDefault).toBe(false);
      const stillDefault = list.find(
        (x) => x.eventType === "interview_scheduled",
      );
      expect(stillDefault?.mode).toBe("instant");
      expect(stillDefault?.isDefault).toBe(true);
    });

    it("marks security events with isSecurityLocked", async () => {
      repo.findByUser.mockResolvedValue([]);
      const list = await service.listForRole("u1", "candidate");
      const sec = list.find((x) => x.eventType === "account_password_reset");
      expect(sec?.isSecurityLocked).toBe(true);
      expect(sec?.mode).toBe("instant");
    });
  });

  describe("restoreDefaults", () => {
    it("with category 'all' deletes all preference rows", async () => {
      repo.deleteAllForUser.mockResolvedValue(7);
      const { deleted } = await service.restoreDefaults("u1", {
        category: "all",
      });
      expect(deleted).toBe(7);
      expect(repo.deleteAllForUser).toHaveBeenCalledWith("u1");
    });

    it("with category 'applications' only deletes application-event rows", async () => {
      repo.deleteForCategory.mockResolvedValue(2);
      const { deleted } = await service.restoreDefaults("u1", {
        category: "applications",
      });
      expect(deleted).toBe(2);
      const call = repo.deleteForCategory.mock.calls[0];
      expect(call[1]).toEqual(
        expect.arrayContaining([
          "application_status_changed",
          "new_application_received",
          "candidate_withdrew",
        ]),
      );
    });
  });
});
