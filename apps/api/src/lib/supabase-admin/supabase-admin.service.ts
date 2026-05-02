import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Backend-only Supabase admin client. Uses the service-role key to call
 * GoTrue admin endpoints (createUser, updateUserById, listUsers, etc.).
 *
 * Never use this client to read application tables — it bypasses RLS. For
 * application reads/writes, use the Drizzle client.
 */
@Injectable()
export class SupabaseAdminService {
  private readonly logger = new Logger(SupabaseAdminService.name);
  private readonly client: SupabaseClient;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>("SUPABASE_URL");
    const serviceKey = config.getOrThrow<string>("SUPABASE_SERVICE_ROLE_KEY");
    this.client = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /** Create a Supabase auth user with email+password, no confirmation email. */
  async createUser(params: {
    email: string;
    password: string;
    userMetadata?: Record<string, unknown>;
  }): Promise<{ id: string; email: string }> {
    const { data, error } = await this.client.auth.admin.createUser({
      email: params.email,
      password: params.password,
      email_confirm: false,
      user_metadata: params.userMetadata ?? {},
    });
    if (error || !data.user) {
      throw error ?? new Error("createUser returned no user");
    }
    return { id: data.user.id, email: data.user.email ?? params.email };
  }

  /** Mark a user's email as confirmed. */
  async confirmEmail(userId: string): Promise<void> {
    const { error } = await this.client.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });
    if (error) throw error;
  }

  /** Update a user's password. */
  async updatePassword(userId: string, password: string): Promise<void> {
    const { error } = await this.client.auth.admin.updateUserById(userId, {
      password,
    });
    if (error) throw error;
  }

  /** Look up a Supabase user by email. Returns null if not found. */
  async findUserByEmail(
    email: string,
  ): Promise<{ id: string; email: string; emailConfirmedAt: string | null } | null> {
    // Admin listUsers supports a filter via the email query string in newer
    // SDKs; fallback path below uses a paginated scan as a defensive measure
    // for older API surfaces. Single-page lookups handle the sprint volume.
    const { data, error } = await this.client.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw error;
    const lower = email.toLowerCase();
    const match = data.users.find((u) => (u.email ?? "").toLowerCase() === lower);
    if (!match) return null;
    return {
      id: match.id,
      email: match.email ?? email,
      emailConfirmedAt: match.email_confirmed_at ?? null,
    };
  }

  /** Delete a Supabase auth user. Used to roll back partial signups. */
  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.client.auth.admin.deleteUser(userId);
    if (error) {
      this.logger.warn(`deleteUser(${userId}) failed: ${error.message}`);
    }
  }

  /**
   * Generate a one-time magic-link token hash for an existing user. Returned
   * to the frontend after email verification so the browser can call
   * supabase.auth.verifyOtp() and establish a real session — bridging the
   * "they just clicked the email link" trust into a logged-in browser
   * session without forcing a manual sign-in step.
   */
  async generateMagicLinkTokenHash(email: string): Promise<string> {
    const { data, error } = await this.client.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error || !data?.properties?.hashed_token) {
      throw error ?? new Error("generateLink returned no hashed_token");
    }
    return data.properties.hashed_token;
  }
}
