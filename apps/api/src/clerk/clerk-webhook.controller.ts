import {
  BadRequestException,
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  ServiceUnavailableException,
  type RawBodyRequest,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { WebhookEvent } from "@clerk/backend";
import type { FastifyRequest } from "fastify";
import { Webhook } from "svix";

import { Public } from "../common/decorators/public.decorator";
import { ProfileProvisioningService } from "./profile-provisioning.service";

/**
 * Receives Clerk user lifecycle webhooks (Svix-signed) and provisions the local
 * profile. Production path; local dev relies on the guard's lazy fallback since
 * Clerk cannot reach localhost. Returns 503 until CLERK_WEBHOOK_SECRET is set.
 */
@Controller({ path: "webhooks/clerk", version: "1" })
export class ClerkWebhookController {
  private readonly logger = new Logger(ClerkWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly provisioning: ProfileProvisioningService,
  ) {}

  @Post()
  @Public()
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<FastifyRequest>,
  ): Promise<{ received: boolean }> {
    const secret = this.config.get<string>("CLERK_WEBHOOK_SECRET");
    if (!secret) {
      throw new ServiceUnavailableException({
        code: "WEBHOOK_NOT_CONFIGURED",
        message: "CLERK_WEBHOOK_SECRET is not set",
      });
    }

    const payload = req.rawBody?.toString("utf8");
    if (!payload) {
      throw new BadRequestException({
        code: "MISSING_BODY",
        message: "Missing raw request body (enable rawBody)",
      });
    }

    const headers = req.headers;
    let event: WebhookEvent;
    try {
      event = new Webhook(secret).verify(payload, {
        "svix-id": String(headers["svix-id"] ?? ""),
        "svix-timestamp": String(headers["svix-timestamp"] ?? ""),
        "svix-signature": String(headers["svix-signature"] ?? ""),
      }) as WebhookEvent;
    } catch {
      throw new BadRequestException({
        code: "INVALID_SIGNATURE",
        message: "Invalid webhook signature",
      });
    }

    if (event.type === "user.created" || event.type === "user.updated") {
      await this.provisioning.upsert(
        this.provisioning.fromWebhookUser(event.data),
      );
    } else if (event.type === "user.deleted" && event.data.id) {
      await this.provisioning.markDeleted(event.data.id);
    }

    return { received: true };
  }
}
