import { Inject, Injectable, Logger } from "@nestjs/common";
import { auditLogsTable } from "@aurahire/db";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../db/db.module";
import { EventsService } from "../realtime";
import type { AuditLogInput } from "./audit.types";

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly events: EventsService,
  ) {}

  /**
   * Append an audit row. Non-blocking: failures are logged, never thrown.
   * Audit writes must not break user flows.
   */
  async log(input: AuditLogInput): Promise<void> {
    try {
      const inserted = await this.db
        .insert(auditLogsTable)
        .values({
          actorId: input.actorId,
          actorType: input.actorType,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          companyId: input.companyId ?? null,
          details: input.details ?? {},
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        })
        .returning({
          id: auditLogsTable.id,
          createdAt: auditLogsTable.createdAt,
        });

      const row = inserted[0];
      if (row) {
        this.events.emitAuditEntry({
          auditId: row.id,
          actorId: input.actorId ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          createdAt:
            row.createdAt instanceof Date
              ? row.createdAt.toISOString()
              : new Date(row.createdAt).toISOString(),
          summary: `${input.action} on ${input.entityType}`,
        });
      }
    } catch (err) {
      this.logger.error(
        `Audit write failed for action=${input.action} entity=${input.entityType}:${input.entityId}: ${(err as Error).message}`,
      );
    }
  }
}
