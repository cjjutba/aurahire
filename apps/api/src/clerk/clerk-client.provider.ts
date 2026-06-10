import type { FactoryProvider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClerkClient, type ClerkClient } from "@clerk/backend";

import { CLERK_CLIENT } from "./clerk.constants";

/** Singleton Clerk Backend API client (used for lazy profile provisioning + role sync). */
export const ClerkClientProvider: FactoryProvider<ClerkClient> = {
  provide: CLERK_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): ClerkClient =>
    createClerkClient({
      secretKey: config.getOrThrow<string>("CLERK_SECRET_KEY"),
      publishableKey: config.get<string>("CLERK_PUBLISHABLE_KEY"),
    }),
};
