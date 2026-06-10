-- Auth tokens - backend-owned email verification + password reset
-- Created for Slice: backend email auth (Mailpit dev / Resend prod)

CREATE TABLE IF NOT EXISTS "auth_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "email" text NOT NULL,
  "kind" text NOT NULL,
  "token_hash" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "ip_address" inet,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "auth_tokens_kind_check" CHECK ("kind" IN ('email_verification', 'password_reset'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_tokens_token_hash_unique" ON "auth_tokens" ("token_hash");
CREATE INDEX IF NOT EXISTS "auth_tokens_user_kind_idx" ON "auth_tokens" ("user_id", "kind");
CREATE INDEX IF NOT EXISTS "auth_tokens_email_kind_idx" ON "auth_tokens" ("email", "kind");
CREATE INDEX IF NOT EXISTS "auth_tokens_expires_idx" ON "auth_tokens" ("expires_at");

-- RLS - service role only. No application-side access.
ALTER TABLE "auth_tokens" ENABLE ROW LEVEL SECURITY;

-- Deny everything by default. Service-role connections bypass RLS, so the
-- backend (which uses service role for admin operations) can read/write freely.
CREATE POLICY "auth_tokens_no_anon" ON "auth_tokens"
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);
