import { Inject, Injectable, Logger } from "@nestjs/common";
import { auditLogsTable } from "@aurahire/db";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../db/db.module";
import type { AuditLogInput } from "./audit.types";

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  /**
   * Append an audit row. Non-blocking: failures are logged, never thrown.
   * Audit writes must not break user flows.
   */
  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.db.insert(auditLogsTable).values({
        actorId: input.actorId,
        actorType: input.actorType,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        details: input.details ?? {},
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      });
    } catch (err) {
      this.logger.error(
        `Audit write failed for action=${input.action} entity=${input.entityType}:${input.entityId}: ${(err as Error).message}`,
      );
    }
  }
}
