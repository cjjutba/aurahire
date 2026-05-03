import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { AUDIT_ACTIONS, AuditService } from "../audit";
import { SupabaseAdminService } from "../lib/supabase-admin";

const CRON_NAME = "cleanup-unverified-accounts";
const CRON_ENTITY_SENTINEL = "00000000-0000-0000-0000-000000000000";
const UNVERIFIED_THRESHOLD_DAYS = 7;

@Injectable()
export class CleanupUnverifiedAccountsCron {
  private readonly logger = new Logger(CleanupUnverifiedAccountsCron.name);

  constructor(
    private readonly audit: AuditService,
    private readonly supabaseAdmin: SupabaseAdminService,
  ) {}

  /** Sundays 02:00 server time (UTC in dev container). */
  @Cron("0 2 * * 0", { name: CRON_NAME })
  async run(): Promise<{ affectedRows: number; durationMs: number }> {
    return this.execute();
  }

  async execute(): Promise<{ affectedRows: number; durationMs: number }> {
    const startedAt = Date.now();

    try {
      const candidates =
        await this.supabaseAdmin.listUnconfirmedOlderThan(UNVERIFIED_THRESHOLD_DAYS);

      if (candidates.length === 0) {
        const durationMs = Date.now() - startedAt;
        this.logger.log(`[${CRON_NAME}] no unverified accounts older than ${UNVERIFIED_THRESHOLD_DAYS} days`);
        await this.audit.log({
          actorId: null,
          actorType: "system",
          action: AUDIT_ACTIONS.CRON_CLEANUP_UNVERIFIED_ACCOUNTS_EXECUTED,
          entityType: "cron",
          entityId: CRON_ENTITY_SENTINEL,
          details: { affectedRows: 0, durationMs },
        });
        return { affectedRows: 0, durationMs };
      }

      let deletedCount = 0;
      for (const u of candidates) {
        try {
          await this.supabaseAdmin.deleteUser(u.id);
          // profiles row cascades on auth.users delete via FK; no explicit profile delete needed.
          await this.audit.log({
            actorId: null,
            actorType: "system",
            action: AUDIT_ACTIONS.USER_DELETED_UNVERIFIED_CLEANUP,
            entityType: "profile",
            entityId: u.id,
            details: {
              email: u.email,
              createdAt: u.createdAt,
              reason: `unverified > ${UNVERIFIED_THRESHOLD_DAYS} days`,
            },
          });
          deletedCount++;
        } catch (innerErr) {
          this.logger.warn(
            `[${CRON_NAME}] delete failed for user ${u.id}: ${(innerErr as Error).message}`,
          );
        }
      }

      const durationMs = Date.now() - startedAt;
      await this.audit.log({
        actorId: null,
        actorType: "system",
        action: AUDIT_ACTIONS.CRON_CLEANUP_UNVERIFIED_ACCOUNTS_EXECUTED,
        entityType: "cron",
        entityId: CRON_ENTITY_SENTINEL,
        details: { affectedRows: deletedCount, durationMs, candidatesScanned: candidates.length },
      });

      this.logger.log(
        `[${CRON_NAME}] deleted ${deletedCount} unverified user(s) in ${durationMs}ms`,
      );
      return { affectedRows: deletedCount, durationMs };
    } catch (err) {
      this.logger.error(`[${CRON_NAME}] failed: ${(err as Error).message}`);
      throw err;
    }
  }
}
