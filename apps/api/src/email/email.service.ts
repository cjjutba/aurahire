import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { render } from "@react-email/render";
import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import type { ReactElement } from "react";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  template: ReactElement;
  /** Optional plain-text fallback. If omitted, derived from HTML. */
  text?: string;
  /** Optional reply-to. */
  replyTo?: string;
}

/**
 * Transport-switching email service.
 *
 * - Development (NODE_ENV !== 'production'): Nodemailer SMTP → Mailpit (localhost:1025)
 * - Production (NODE_ENV === 'production'): Resend SDK
 *
 * Templates are React Email components rendered to HTML at send time.
 * Failures are LOGGED, NEVER THROWN — email send must not break user flows.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;
  private readonly isProd: boolean;

  private smtpTransport: Transporter | null = null;
  private resendClient: Resend | null = null;

  constructor(private readonly config: ConfigService) {
    this.fromEmail = config.get<string>("FROM_EMAIL") ?? "onboarding@resend.dev";
    this.isProd = config.get<string>("NODE_ENV") === "production";
  }

  onModuleInit(): void {
    if (this.isProd) {
      const apiKey = this.config.get<string>("RESEND_API_KEY");
      if (!apiKey) {
        this.logger.error("RESEND_API_KEY missing — email sending will fail in production");
        return;
      }
      this.resendClient = new Resend(apiKey);
      this.logger.log(`Email transport: Resend (from ${this.fromEmail})`);
    } else {
      const host = this.config.get<string>("SMTP_HOST") ?? "localhost";
      const port = Number(this.config.get<string>("SMTP_PORT") ?? 1025);
      this.smtpTransport = nodemailer.createTransport({
        host,
        port,
        secure: false,
        ignoreTLS: true,
      });
      this.logger.log(`Email transport: SMTP ${host}:${port} (Mailpit) from ${this.fromEmail}`);
    }
  }

  async send(opts: SendEmailOptions): Promise<void> {
    try {
      const html = await render(opts.template);
      const text = opts.text ?? (await render(opts.template, { plainText: true }));
      const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];

      if (this.isProd && this.resendClient) {
        const { error } = await this.resendClient.emails.send({
          from: this.fromEmail,
          to: recipients,
          subject: opts.subject,
          html,
          text,
          replyTo: opts.replyTo,
        });
        if (error) {
          this.logger.error(
            `Resend error sending to ${recipients.join(",")}: ${error.message}`,
          );
        }
      } else if (this.smtpTransport) {
        await this.smtpTransport.sendMail({
          from: this.fromEmail,
          to: recipients.join(","),
          subject: opts.subject,
          html,
          text,
          replyTo: opts.replyTo,
        });
      } else {
        this.logger.warn(
          `No email transport configured; skipping send to ${recipients.join(",")}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Email send failed to ${Array.isArray(opts.to) ? opts.to.join(",") : opts.to}: ${(err as Error).message}`,
      );
      // Intentional swallow.
    }
  }
}
