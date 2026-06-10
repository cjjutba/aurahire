import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ClerkClient, User, UserJSON } from "@clerk/backend";
import { eq } from "drizzle-orm";
import { profilesTable, USER_ROLES } from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../db/db.module";
import { CLERK_CLIENT } from "./clerk.constants";

type UserRole = (typeof USER_ROLES)[number];

interface ProvisionInput {
  clerkUserId: string;
  email: string;
  fullName: string;
  role: UserRole;
}

/**
 * Creates/updates the local `profiles` row that mirrors a Clerk user. Two entry
 * points share one upsert:
 *  - the Clerk webhook (user.created/updated) — production path
 *  - the ClerkAuthGuard lazy fallback (ensureFromClerk) — makes local dev work
 *    without a publicly-reachable webhook, and covers the webhook-race window.
 */
@Injectable()
export class ProfileProvisioningService {
  private readonly logger = new Logger(ProfileProvisioningService.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    @Inject(CLERK_CLIENT) private readonly clerk: ClerkClient,
  ) {}

  /** Upsert a profile keyed by clerk_user_id. */
  async upsert(input: ProvisionInput): Promise<void> {
    await this.db
      .insert(profilesTable)
      .values({
        clerkUserId: input.clerkUserId,
        email: input.email,
        fullName: input.fullName,
        role: input.role,
      })
      .onConflictDoUpdate({
        target: profilesTable.clerkUserId,
        set: {
          email: input.email,
          fullName: input.fullName,
          updatedAt: new Date(),
        },
      });
    this.logger.log(`Provisioned profile for Clerk user ${input.clerkUserId}`);
  }

  /** Lazy path: fetch the Clerk user via the Backend API, then upsert. */
  async ensureFromClerk(clerkUserId: string): Promise<void> {
    const user = await this.clerk.users.getUser(clerkUserId);
    await this.upsert(this.fromClerkUser(user));
  }

  async markDeleted(clerkUserId: string): Promise<void> {
    await this.db
      .update(profilesTable)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(eq(profilesTable.clerkUserId, clerkUserId));
  }

  /** Backend API `User` (camelCase) → provision input. */
  fromClerkUser(user: User): ProvisionInput {
    const email =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      `${user.id}@placeholder.clerk`;
    return {
      clerkUserId: user.id,
      email,
      fullName: this.buildName(user.firstName, user.lastName, email),
      role: this.normalizeRole(
        user.publicMetadata?.["role"] ?? user.unsafeMetadata?.["role"],
      ),
    };
  }

  /** Webhook `UserJSON` (snake_case) → provision input. */
  fromWebhookUser(data: UserJSON): ProvisionInput {
    const email =
      data.email_addresses.find((e) => e.id === data.primary_email_address_id)
        ?.email_address ??
      data.email_addresses[0]?.email_address ??
      `${data.id}@placeholder.clerk`;
    return {
      clerkUserId: data.id,
      email,
      fullName: this.buildName(data.first_name, data.last_name, email),
      role: this.normalizeRole(
        data.public_metadata?.["role"] ?? data.unsafe_metadata?.["role"],
      ),
    };
  }

  private buildName(
    first: string | null,
    last: string | null,
    email: string,
  ): string {
    const joined = [first, last].filter(Boolean).join(" ").trim();
    return joined || email.split("@")[0] || "User";
  }

  private normalizeRole(value: unknown): UserRole {
    return (USER_ROLES as readonly string[]).includes(value as string)
      ? (value as UserRole)
      : "candidate";
  }
}
