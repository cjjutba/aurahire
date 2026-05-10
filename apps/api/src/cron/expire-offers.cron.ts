import { ConfigService } from "@nestjs/config";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { and, eq, lt, sql } from "drizzle-orm";
import {
  offersTable,
  applicationsTable,
  profilesTable,
  jobsTable,
  companiesTable,
} from "@aurahire/db";

import { AUDIT_ACTIONS, AuditService } from "../audit";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../db/db.module";
import { EmailService } from "../email/email.service";
import { OfferExpiredEmail } from "../email/templates/offer-expired";
import { NotificationsService } from "../modules/notifications/notifications.service";
import { ApplicationsService } from "../modules/applications/applications.service";
import {
  ApplicationsRepository,
  type ApplicationsTx,
} from "../modules/applications/applications.repository";

const CRON_NAME = "expire-offers";
// audit_logs.entity_id is NOT NULL UUID; sentinel for cron-level entries.
const CRON_ENTITY_SENTINEL = "00000000-0000-0000-0000-000000000000";

@Injectable()
export class ExpireOffersCron {
  private readonly logger = new Logger(ExpireOffersCron.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly applicationsService: ApplicationsService,
    private readonly applicationsRepo: ApplicationsRepository,
  ) {}

  /** Hourly at minute 0. */
  @Cron("0 * * * *", { name: CRON_NAME })
  async run(): Promise<{ affectedRows: number; durationMs: number }> {
    return this.execute();
  }

  /** Public for the dev-only debug endpoint to invoke manually. */
  async execute(): Promise<{ affectedRows: number; durationMs: number }> {
    const startedAt = Date.now();

    try {
      const candidates = await this.db
        .select({
          offerId: offersTable.id,
          applicationId: offersTable.applicationId,
          candidateId: applicationsTable.candidateId,
          candidateEmail: profilesTable.email,
          candidateName: profilesTable.fullName,
          jobId: jobsTable.id,
          jobTitle: jobsTable.title,
          recruiterId: jobsTable.recruiterId,
          companyName: companiesTable.name,
          companyLogoUrl: companiesTable.logoUrl,
        })
        .from(offersTable)
        .innerJoin(
          applicationsTable,
          eq(applicationsTable.id, offersTable.applicationId),
        )
        .innerJoin(
          profilesTable,
          eq(profilesTable.id, applicationsTable.candidateId),
        )
        .innerJoin(jobsTable, eq(jobsTable.id, applicationsTable.jobId))
        .innerJoin(companiesTable, eq(companiesTable.id, jobsTable.companyId))
        .where(
          and(
            eq(offersTable.status, "pending"),
            sql`${offersTable.expiresAt} IS NOT NULL`,
            lt(offersTable.expiresAt, new Date()),
          ),
        );

      if (candidates.length === 0) {
        const durationMs = Date.now() - startedAt;
        this.logger.log(`[${CRON_NAME}] no expired pending offers`);
        await this.audit.log({
          actorId: null,
          actorType: "system",
          action: AUDIT_ACTIONS.CRON_EXPIRE_OFFERS_EXECUTED,
          entityType: "cron",
          entityId: CRON_ENTITY_SENTINEL,
          details: { affectedRows: 0, durationMs },
        });
        return { affectedRows: 0, durationMs };
      }

      const offerIds = candidates.map((c) => c.offerId);
      await this.db
        .update(offersTable)
        .set({ status: "expired", updatedAt: new Date() })
        .where(sql`${offersTable.id} = ANY(${offerIds}::uuid[])`);

      const appUrl =
        this.config.get<string>("APP_URL") ?? "http://localhost:3000";

      // Per-offer audit + email + in-app notify (both candidate and recruiter)
      // — best-effort; one failure doesn't fail the cron.
      for (const c of candidates) {
        try {
          await this.audit.log({
            actorId: null,
            actorType: "system",
            action: AUDIT_ACTIONS.OFFER_EXPIRED,
            entityType: "offer",
            entityId: c.offerId,
            details: {
              applicationId: c.applicationId,
              candidateId: c.candidateId,
              recruiterId: c.recruiterId,
              jobId: c.jobId,
              jobTitle: c.jobTitle,
            },
          });

          await this.email.send({
            to: c.candidateEmail,
            subject: `Your offer for ${c.jobTitle} has expired`,
            template: OfferExpiredEmail({
              candidateName: c.candidateName,
              jobTitle: c.jobTitle,
              companyName: c.companyName,
              applicationUrl: `${appUrl}/dashboard/applications/${c.applicationId}`,
              company: { name: c.companyName, logoUrl: c.companyLogoUrl },
            }),
          });

          // In-app notify: candidate.
          await this.notifications.emit({
            userId: c.candidateId,
            eventType: "offer_expired",
            entityType: "offer",
            entityId: c.offerId,
            metadata: {
              offerId: c.offerId,
              applicationId: c.applicationId,
              jobId: c.jobId,
              jobTitle: c.jobTitle,
              companyName: c.companyName,
            },
          });

          // In-app notify: owning recruiter.
          await this.notifications.emit({
            userId: c.recruiterId,
            eventType: "offer_expired",
            entityType: "offer",
            entityId: c.offerId,
            metadata: {
              offerId: c.offerId,
              applicationId: c.applicationId,
              jobId: c.jobId,
              jobTitle: c.jobTitle,
              candidateId: c.candidateId,
              candidateName: c.candidateName,
              companyName: c.companyName,
            },
          });

          // Auto-advance the application to offer_declined so it leaves the
          // recruiter's offer pipeline. Wrapped in its own transaction with
          // FOR UPDATE so a race with a recruiter action serialises.
          await this.db.transaction(async (tx) => {
            const lockedApp = await this.applicationsRepo.findByIdForUpdate(
              tx as ApplicationsTx,
              c.applicationId,
            );
            if (!lockedApp || lockedApp.status !== "offer") return;

            await this.applicationsService.transitionFromSystem(
              null,
              c.applicationId,
              "offer_declined",
              "Offer expired without response",
              {},
              tx as ApplicationsTx,
            );
          });

          // Distinct audit row so reports can separate decline vs expiry causes.
          await this.audit.log({
            actorId: null,
            actorType: "system",
            action: AUDIT_ACTIONS.APPLICATION_AUTO_TRANSITION_OFFER_EXPIRED,
            entityType: "application",
            entityId: c.applicationId,
            details: {
              offerId: c.offerId,
              jobId: c.jobId,
              expiredAt: new Date().toISOString(),
            },
          });
        } catch (innerErr) {
          this.logger.warn(
            `[${CRON_NAME}] post-expire side effect failed for offer ${c.offerId}: ${(innerErr as Error).message}`,
          );
        }
      }

      const durationMs = Date.now() - startedAt;
      await this.audit.log({
        actorId: null,
        actorType: "system",
        action: AUDIT_ACTIONS.CRON_EXPIRE_OFFERS_EXECUTED,
        entityType: "cron",
        entityId: CRON_ENTITY_SENTINEL,
        details: { affectedRows: candidates.length, durationMs },
      });

      this.logger.log(
        `[${CRON_NAME}] expired ${candidates.length} offer(s) in ${durationMs}ms`,
      );
      return { affectedRows: candidates.length, durationMs };
    } catch (err) {
      this.logger.error(`[${CRON_NAME}] failed: ${(err as Error).message}`);
      throw err;
    }
  }
}
