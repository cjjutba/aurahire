import { Global, Module } from "@nestjs/common";

import { ClerkClientProvider } from "./clerk-client.provider";
import { ClerkWebhookController } from "./clerk-webhook.controller";
import { ProfileProvisioningService } from "./profile-provisioning.service";

/**
 * Global Clerk integration: the Backend API client + profile provisioning
 * (webhook + lazy guard fallback). Replaces the Supabase auth admin surface.
 */
@Global()
@Module({
  controllers: [ClerkWebhookController],
  providers: [ClerkClientProvider, ProfileProvisioningService],
  exports: [ProfileProvisioningService],
})
export class ClerkModule {}
