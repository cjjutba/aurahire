import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import * as React from "react";
import { ConfigService } from "@nestjs/config";

import {
  NOTIFICATION_EMAIL_QUEUE,
  type NotificationEmailJobData,
} from "./queues";
import { NotificationsRepository } from "./notifications.repository";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { EmailService } from "../../email";
import { TEMPLATES, emailSubject } from "./templates";
import { DigestEmail } from "./templates/digest-email";

@Processor(NOTIFICATION_EMAIL_QUEUE)
export class NotificationEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationEmailProcessor.name);

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly profiles: ProfilesRepository,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<NotificationEmailJobData>): Promise<void> {
    if (job.data.kind === "instant") {
      await this.processInstant(job.data.notificationId);
      return;
    }
    await this.processDigest(job.data.userId, job.data.notificationIds);
  }

  private async processInstant(notificationId: string): Promise<void> {
    const row = await this.repo.findById(notificationId);
    if (!row) {
      this.logger.warn(
        `processInstant: notification not found: ${notificationId}`,
      );
      return;
    }
    if (row.emailSentAt) {
      this.logger.debug(`processInstant: already sent: ${notificationId}`);
      return;
    }
    const profile = await this.profiles.findById(row.userId);
    if (!profile) {
      this.logger.warn(
        `processInstant: profile not found for user ${row.userId}`,
      );
      return;
    }

    const role = profile.role as "candidate" | "recruiter" | "admin";
    const tpl = TEMPLATES[row.eventType];
    const appOrigin =
      this.config.get<string>("APP_URL") ?? "http://localhost:3000";
    const Component = tpl.EmailComponent;
    const element = React.createElement(Component, {
      metadata: row.metadata ?? {},
      appOrigin,
      role,
    });

    await this.email.send({
      to: profile.email,
      subject: emailSubject(row.eventType, row.metadata ?? {}),
      template: element,
    });
    await this.repo.setEmailSent(notificationId);
  }

  private async processDigest(
    userId: string,
    notificationIds: string[],
  ): Promise<void> {
    const profile = await this.profiles.findById(userId);
    if (!profile) {
      this.logger.warn(`processDigest: profile not found for user ${userId}`);
      return;
    }
    const rows = await Promise.all(
      notificationIds.map((id) => this.repo.findById(id)),
    );
    const validRows = rows
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({
        id: r.id,
        eventType: r.eventType,
        title: r.title,
        body: r.body,
        link: r.link,
        metadata: r.metadata ?? {},
        createdAt: r.createdAt.toISOString(),
      }));
    if (validRows.length === 0) {
      this.logger.warn(`processDigest: no valid rows for user ${userId}`);
      return;
    }

    const role = profile.role as "candidate" | "recruiter" | "admin";
    const appOrigin =
      this.config.get<string>("APP_URL") ?? "http://localhost:3000";
    const element = React.createElement(DigestEmail, {
      rows: validRows,
      appOrigin,
      role,
    });

    await this.email.send({
      to: profile.email,
      subject: `Your AuraHire daily summary - ${validRows.length} update${
        validRows.length === 1 ? "" : "s"
      }`,
      template: element,
    });
    await Promise.all(validRows.map((r) => this.repo.setEmailSent(r.id)));
  }
}
