import { randomBytes, createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { authTokensTable } from "@aurahire/db";
import type { AuthToken } from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";
import { SupabaseAdminService } from "../../lib/supabase-admin";
import { EmailService } from "../../email/email.service";
import { AuditService, AUDIT_ACTIONS } from "../../audit";
import { VerifyEmailTemplate } from "../../email/templates/verify-email";
import { PasswordResetTemplate } from "../../email/templates/password-reset";
import { ProfilesService } from "../profiles/profiles.service";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TTL_MS = 60 * 60 * 1000; // 1h

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface CandidateSignupMetadata {
  role: "candidate";
  fullName: string;
  phone: string;
}

interface RecruiterSignupMetadata {
  role: "recruiter";
  fullName: string;
  phone: string;
}

type SignupMetadata = CandidateSignupMetadata | RecruiterSignupMetadata;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly webUrl: string;

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
    private readonly profilesService: ProfilesService,
    config: ConfigService,
  ) {
    this.webUrl = config.get<string>("APP_URL") ?? "http://localhost:3000";
  }

  // ==========================================================================
  // SIGNUP — CANDIDATE
  // ==========================================================================

  async signupCandidate(
    input: {
      fullName: string;
      email: string;
      phone: string;
      password: string;
    },
    meta: RequestMeta,
  ): Promise<{ message: string }> {
    const userId = await this.upsertUnconfirmedUser(
      input.email,
      input.password,
      {
        role: "candidate",
        full_name: input.fullName,
        phone: input.phone,
      },
    );

    await this.issueVerificationEmail(
      userId,
      input.email,
      input.fullName,
      {
        role: "candidate",
        fullName: input.fullName,
        phone: input.phone,
      },
      meta,
    );

    return { message: "Verification email sent." };
  }

  // ==========================================================================
  // SIGNUP — RECRUITER
  // ==========================================================================

  async signupRecruiter(
    input: {
      fullName: string;
      email: string;
      phone: string;
      password: string;
    },
    meta: RequestMeta,
  ): Promise<{ message: string }> {
    const userId = await this.upsertUnconfirmedUser(
      input.email,
      input.password,
      {
        role: "recruiter",
        full_name: input.fullName,
        phone: input.phone,
      },
    );

    await this.issueVerificationEmail(
      userId,
      input.email,
      input.fullName,
      {
        role: "recruiter",
        fullName: input.fullName,
        phone: input.phone,
      },
      meta,
    );

    return { message: "Verification email sent." };
  }

  // ==========================================================================
  // VERIFY EMAIL
  // ==========================================================================

  async verifyEmail(
    token: string,
    meta: RequestMeta,
  ): Promise<{
    role: "candidate" | "recruiter";
    email: string;
    sessionTokenHash: string;
  }> {
    const row = await this.consumeToken(token, "email_verification");
    const metadata = this.decodeSignupMetadata(row.metadata);

    try {
      await this.supabaseAdmin.confirmEmail(row.userId);
    } catch (err) {
      this.logger.error(
        `confirmEmail failed for ${row.userId}: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException({
        code: "EMAIL_VERIFICATION_FAILED",
        message: "Could not finalize verification. Please try again.",
      });
    }

    if (metadata.role === "candidate") {
      await this.profilesService
        .initCandidateProfile(
          row.userId,
          row.email,
          { fullName: metadata.fullName, phone: metadata.phone },
          meta,
        )
        .catch((err) => this.swallowProfileConflict(err, row.userId));
    } else {
      await this.profilesService
        .initRecruiterProfile(
          row.userId,
          row.email,
          {
            fullName: metadata.fullName,
            phone: metadata.phone,
          },
          meta,
        )
        .catch((err) => this.swallowProfileConflict(err, row.userId));
    }

    void this.auditService.log({
      actorId: row.userId,
      actorType: "user",
      action: AUDIT_ACTIONS.USER_EMAIL_VERIFIED,
      entityType: "user",
      entityId: row.userId,
      details: { email: row.email },
      ...meta,
    });

    let sessionTokenHash: string;
    try {
      sessionTokenHash = await this.supabaseAdmin.generateMagicLinkTokenHash(
        row.email,
      );
    } catch (err) {
      this.logger.error(
        `generateMagicLink failed for ${row.userId}: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException({
        code: "SESSION_BOOTSTRAP_FAILED",
        message:
          "Verification succeeded but auto sign-in failed. Please sign in manually.",
      });
    }

    return { role: metadata.role, email: row.email, sessionTokenHash };
  }

  // ==========================================================================
  // RESEND VERIFICATION
  // ==========================================================================

  async resendVerification(
    email: string,
    meta: RequestMeta,
  ): Promise<{ message: string }> {
    const user = await this.supabaseAdmin
      .findUserByEmail(email)
      .catch((err) => {
        this.logger.warn(
          `resend-verification: findUserByEmail threw for ${email}: ${(err as Error).message}`,
        );
        return null;
      });
    if (!user) {
      this.logger.log(
        `resend-verification: no user found for ${email} — silent no-op`,
      );
      return {
        message:
          "If that account exists and isn't yet verified, a new link is on its way.",
      };
    }
    if (user.emailConfirmedAt) {
      this.logger.log(
        `resend-verification: ${email} already confirmed at ${user.emailConfirmedAt} — silent no-op`,
      );
      return {
        message:
          "If that account exists and isn't yet verified, a new link is on its way.",
      };
    }

    // Reuse the metadata from the most recent verification token if present;
    // otherwise we cannot rebuild the signup payload, so the user must redo
    // the form. (Edge case — happens only if an op manually pruned tokens.)
    const recent = await this.db
      .select()
      .from(authTokensTable)
      .where(
        and(
          eq(authTokensTable.userId, user.id),
          eq(authTokensTable.kind, "email_verification"),
        ),
      )
      .orderBy(sql`${authTokensTable.createdAt} DESC`)
      .limit(1);

    if (recent.length === 0) {
      this.logger.warn(
        `resend-verification: no prior verification token for user ${user.id} (${email}) — cannot rebuild signup metadata`,
      );
      return {
        message:
          "If that account exists and isn't yet verified, a new link is on its way.",
      };
    }

    const metadata = this.decodeSignupMetadata(recent[0]!.metadata);
    await this.issueVerificationEmail(
      user.id,
      email,
      metadata.fullName,
      metadata,
      meta,
    );
    this.logger.log(`resend-verification: dispatched to ${email}`);

    return {
      message:
        "If that account exists and isn't yet verified, a new link is on its way.",
    };
  }

  // ==========================================================================
  // FORGOT PASSWORD
  // ==========================================================================

  async requestPasswordReset(
    email: string,
    meta: RequestMeta,
  ): Promise<{ message: string }> {
    const user = await this.supabaseAdmin
      .findUserByEmail(email)
      .catch(() => null);
    if (user) {
      const rawToken = this.generateRawToken();
      const tokenHash = this.hashToken(rawToken);
      const expiresAt = new Date(Date.now() + RESET_TTL_MS);

      // Invalidate any prior unconsumed reset tokens for this user.
      await this.db
        .update(authTokensTable)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(authTokensTable.userId, user.id),
            eq(authTokensTable.kind, "password_reset"),
            isNull(authTokensTable.consumedAt),
          ),
        );

      await this.db.insert(authTokensTable).values({
        userId: user.id,
        email: user.email,
        kind: "password_reset",
        tokenHash,
        expiresAt,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
      });

      const resetUrl = `${this.webUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
      await this.emailService.send({
        to: user.email,
        subject: "Reset your AuraHire password",
        template: PasswordResetTemplate({ resetUrl }),
      });

      void this.auditService.log({
        actorId: user.id,
        actorType: "user",
        action: AUDIT_ACTIONS.USER_PASSWORD_RESET_REQUESTED,
        entityType: "user",
        entityId: user.id,
        details: { email: user.email },
        ...meta,
      });
    }

    return {
      message:
        "If an account exists for that email, a reset link is on its way.",
    };
  }

  // ==========================================================================
  // ISSUE PASSWORD RESET TOKEN FOR USER (admin-driven)
  // ==========================================================================

  /**
   * Issues a password-reset token for a known user without performing
   * email-based lookup, audit logging, or email send. Caller is responsible
   * for emailing + auditing. Used by AdminUsersService for force-password-reset.
   * Returns the user-facing reset URL and the token expiry.
   */
  async issuePasswordResetTokenForUser(input: {
    userId: string;
    email: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<{ url: string; expiresAt: Date }> {
    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);

    await this.db
      .update(authTokensTable)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(authTokensTable.userId, input.userId),
          eq(authTokensTable.kind, "password_reset"),
          isNull(authTokensTable.consumedAt),
        ),
      );

    await this.db.insert(authTokensTable).values({
      userId: input.userId,
      email: input.email,
      kind: "password_reset",
      tokenHash,
      expiresAt,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    const url = `${this.webUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
    return { url, expiresAt };
  }

  // ==========================================================================
  // RESET PASSWORD
  // ==========================================================================

  async resetPassword(
    token: string,
    newPassword: string,
    meta: RequestMeta,
  ): Promise<{ message: string }> {
    const row = await this.consumeToken(token, "password_reset");

    try {
      await this.supabaseAdmin.updatePassword(row.userId, newPassword);
    } catch (err) {
      this.logger.error(
        `updatePassword failed for ${row.userId}: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException({
        code: "PASSWORD_RESET_FAILED",
        message: "Could not update password. Please try again.",
      });
    }

    void this.auditService.log({
      actorId: row.userId,
      actorType: "user",
      action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
      entityType: "user",
      entityId: row.userId,
      details: { email: row.email },
      ...meta,
    });

    return { message: "Password updated." };
  }

  // ==========================================================================
  // INTERNAL HELPERS
  // ==========================================================================

  /**
   * Idempotent: if a Supabase user already exists for this email, refresh the
   * password (so the latest signup attempt wins) and reuse the row instead of
   * leaking the existence of confirmed accounts. Returns the user id.
   */
  private async upsertUnconfirmedUser(
    email: string,
    password: string,
    userMetadata: Record<string, unknown>,
  ): Promise<string> {
    const existing = await this.supabaseAdmin
      .findUserByEmail(email)
      .catch(() => null);
    if (existing) {
      if (existing.emailConfirmedAt) {
        throw new ConflictException({
          code: "EMAIL_ALREADY_REGISTERED",
          message: "This email is already registered. Sign in instead.",
        });
      }
      await this.supabaseAdmin.updatePassword(existing.id, password);
      return existing.id;
    }

    try {
      const created = await this.supabaseAdmin.createUser({
        email,
        password,
        userMetadata,
      });
      return created.id;
    } catch (err) {
      this.logger.error(`createUser failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException({
        code: "SIGNUP_FAILED",
        message: "Could not create account. Please try again.",
      });
    }
  }

  private async issueVerificationEmail(
    userId: string,
    email: string,
    fullName: string,
    metadata: SignupMetadata,
    meta: RequestMeta,
  ): Promise<void> {
    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    // Invalidate any prior unconsumed verification tokens for this user.
    await this.db
      .update(authTokensTable)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(authTokensTable.userId, userId),
          eq(authTokensTable.kind, "email_verification"),
          isNull(authTokensTable.consumedAt),
        ),
      );

    await this.db.insert(authTokensTable).values({
      userId,
      email,
      kind: "email_verification",
      tokenHash,
      expiresAt,
      metadata,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    });

    const verifyUrl = `${this.webUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
    await this.emailService.send({
      to: email,
      subject: "Verify your AuraHire account",
      template: VerifyEmailTemplate({ recipientName: fullName, verifyUrl }),
    });

    const auditAction =
      metadata.role === "recruiter"
        ? AUDIT_ACTIONS.USER_REGISTERED_RECRUITER
        : AUDIT_ACTIONS.USER_REGISTERED_CANDIDATE;

    void this.auditService.log({
      actorId: userId,
      actorType: "user",
      action: auditAction,
      entityType: "user",
      entityId: userId,
      details: { email, status: "verification_pending" },
      ...meta,
    });
  }

  private async consumeToken(
    rawToken: string,
    kind: "email_verification" | "password_reset",
  ): Promise<AuthToken> {
    const tokenHash = this.hashToken(rawToken);
    const now = new Date();

    const rows = await this.db
      .select()
      .from(authTokensTable)
      .where(
        and(
          eq(authTokensTable.tokenHash, tokenHash),
          eq(authTokensTable.kind, kind),
          isNull(authTokensTable.consumedAt),
          gt(authTokensTable.expiresAt, now),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      throw new BadRequestException({
        code: "INVALID_TOKEN",
        message: "This link is invalid or has expired.",
      });
    }

    const row = rows[0]!;

    const updateResult = await this.db
      .update(authTokensTable)
      .set({ consumedAt: now })
      .where(
        and(eq(authTokensTable.id, row.id), isNull(authTokensTable.consumedAt)),
      )
      .returning({ id: authTokensTable.id });

    if (updateResult.length === 0) {
      // Lost a race against a concurrent click; treat as invalid.
      throw new BadRequestException({
        code: "INVALID_TOKEN",
        message: "This link has already been used.",
      });
    }

    return row;
  }

  private decodeSignupMetadata(raw: unknown): SignupMetadata {
    if (!raw || typeof raw !== "object") {
      throw new BadRequestException({
        code: "INVALID_TOKEN",
        message: "Token metadata missing. Please sign up again.",
      });
    }
    const obj = raw as Record<string, unknown>;
    if (
      obj.role === "candidate" &&
      typeof obj.fullName === "string" &&
      typeof obj.phone === "string"
    ) {
      return { role: "candidate", fullName: obj.fullName, phone: obj.phone };
    }
    if (
      obj.role === "recruiter" &&
      typeof obj.fullName === "string" &&
      typeof obj.phone === "string"
    ) {
      // Older tokens (issued before company creation moved to /onboarding/start)
      // may still carry a `companyName` field; we ignore it — the verify path
      // no longer creates a company.
      return {
        role: "recruiter",
        fullName: obj.fullName,
        phone: obj.phone,
      };
    }
    throw new BadRequestException({
      code: "INVALID_TOKEN",
      message: "Token metadata is malformed. Please sign up again.",
    });
  }

  /**
   * If a profile already exists (e.g. a duplicate verify click after the row
   * was created), don't fail the verification — the user is already onboarded.
   */
  private swallowProfileConflict(err: unknown, userId: string): void {
    const isConflict =
      (err as { status?: number; getStatus?: () => number })?.status === 409 ||
      (err as { getStatus?: () => number })?.getStatus?.() === 409;
    if (!isConflict) throw err;
    this.logger.log(`Profile already exists for ${userId} — verify reused.`);
  }

  private generateRawToken(): string {
    return randomBytes(32).toString("base64url");
  }

  private hashToken(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }
}
