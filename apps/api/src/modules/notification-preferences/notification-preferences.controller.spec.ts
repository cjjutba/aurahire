// Mock jose (ESM-only) before any module in the chain loads it
jest.mock("jose", () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { NotificationPreferencesController } from "./notification-preferences.controller";
import { NotificationPreferencesService } from "./notification-preferences.service";
import { AuditService } from "../../audit/audit.service";

const buildUser = (overrides: Partial<{ id: string; role: "candidate" | "recruiter" | "admin"; email: string }> = {}) => ({
  id: "u1",
  email: "u@x.io",
  role: "candidate" as const,
  status: "active" as const,
  fullName: "Test",
  profileCompleted: true,
  ...overrides,
});

describe("NotificationPreferencesController", () => {
  let controller: NotificationPreferencesController;
  let service: any;
  let audit: any;

  beforeEach(async () => {
    service = {
      listForRole: jest.fn(),
      getEffectiveMode: jest.fn().mockResolvedValue("instant"),
      upsert: jest.fn(),
      restoreDefaults: jest.fn(),
    };
    audit = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationPreferencesController],
      providers: [
        { provide: NotificationPreferencesService, useValue: service },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    controller = moduleRef.get(NotificationPreferencesController);
  });

  it("list delegates to service.listForRole with the user's id and role", async () => {
    service.listForRole.mockResolvedValue([]);
    await controller.list(buildUser({ role: "recruiter" }) as any);
    expect(service.listForRole).toHaveBeenCalledWith("u1", "recruiter");
  });

  it("upsert audits the change with old and new mode", async () => {
    service.getEffectiveMode.mockResolvedValue("instant");
    service.upsert.mockResolvedValue({ eventType: "application_status_changed", mode: "off" });
    await controller.upsert(
      buildUser() as any,
      { eventType: "application_status_changed", mode: "off" } as any,
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: "user",
        action: expect.stringContaining("notification_preference.updated"),
        details: { eventType: "application_status_changed", oldMode: "instant", newMode: "off" },
      }),
    );
  });

  it("upsert propagates BadRequestException for security events", async () => {
    service.upsert.mockRejectedValue(new BadRequestException());
    await expect(
      controller.upsert(
        buildUser() as any,
        { eventType: "account_password_reset", mode: "off" } as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("upsert returns isDefault: false on the response", async () => {
    service.getEffectiveMode.mockResolvedValue("instant");
    service.upsert.mockResolvedValue({ eventType: "application_status_changed", mode: "off" });
    const result = await controller.upsert(
      buildUser() as any,
      { eventType: "application_status_changed", mode: "off" } as any,
    );
    expect(result).toEqual({
      eventType: "application_status_changed",
      mode: "off",
      isDefault: false,
    });
  });

  it("restoreDefaults audits the reset with category and deleted count", async () => {
    service.restoreDefaults.mockResolvedValue({ deleted: 3 });
    await controller.restoreDefaults(buildUser() as any, { category: "applications" } as any);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: "user",
        action: expect.stringContaining("notification_preferences.reset"),
        details: { category: "applications", deleted: 3 },
      }),
    );
  });

  it("restoreDefaults returns the deleted count", async () => {
    service.restoreDefaults.mockResolvedValue({ deleted: 7 });
    const result = await controller.restoreDefaults(
      buildUser() as any,
      { category: "all" } as any,
    );
    expect(result).toEqual({ deleted: 7 });
  });
});
