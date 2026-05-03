/**
 * Seed DB: truncate every public-schema table, delete every Supabase auth user,
 * then create a default admin account for development.
 *
 * Resulting admin credentials:
 *   email:    admin@admin.com
 *   password: password123
 *   role:     admin
 *   status:   active
 *
 * Requires DATABASE_URL, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY in apps/api/.env.
 *
 * Run from repo root:
 *   pnpm --filter @aurahire/api seed-db -- --yes
 *
 * Without --yes the script refuses to run. This is destructive: every existing
 * candidate, recruiter, job, and audit row is wiped before the seed admin lands.
 */
import "reflect-metadata";
import postgres from "postgres";

// Order matters only for clarity — TRUNCATE ... CASCADE handles FK dependencies.
const PUBLIC_TABLES = [
  "auth_tokens",
  "audit_logs",
  "scoring_config",
  "bias_flags",
  "evidence_excerpts",
  "match_scores",
  "profile_scores",
  "offers",
  "interviews",
  "applications",
  "resumes",
  "jobs",
  "recruiter_profiles",
  "candidate_profiles",
  "companies",
  "profiles",
];

const ADMIN_EMAIL = "admin@admin.com";
const ADMIN_PASSWORD = "password123";
const ADMIN_FULL_NAME = "Sprint Admin";

interface AuthUser {
  id: string;
  email?: string;
}

interface CreatedAuthUser {
  user: { id: string; email: string };
}

async function deleteAllAuthUsers(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<number> {
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  let totalDeleted = 0;
  let totalFailed = 0;

  while (true) {
    const listRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`,
      { headers },
    );
    if (!listRes.ok) {
      const errBody = await listRes.text();
      throw new Error(
        `List users failed: ${listRes.status} ${listRes.statusText} — ${errBody}`,
      );
    }
    const body = (await listRes.json()) as { users: AuthUser[] };
    const users = body.users ?? [];
    if (users.length === 0) break;

    for (const user of users) {
      const delRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${user.id}`,
        { method: "DELETE", headers },
      );
      if (!delRes.ok) {
        process.stderr.write(
          `  ! Failed to delete ${user.email ?? user.id}: ${delRes.status}\n`,
        );
        totalFailed++;
        continue;
      }
      totalDeleted++;
    }

    if (users.length < 1000) break;
  }

  if (totalFailed > 0) {
    process.stderr.write(`  ${totalFailed} user(s) failed to delete\n`);
  }
  return totalDeleted;
}

async function createAdminAuthUser(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ id: string; email: string }> {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        role: "admin",
        full_name: ADMIN_FULL_NAME,
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(
      `Create admin auth user failed: ${res.status} ${res.statusText} — ${errBody}`,
    );
  }

  const body = (await res.json()) as CreatedAuthUser | { id: string; email: string };
  // Supabase admin API may return the user object directly or nested under `user`.
  if ("user" in body) {
    return { id: body.user.id, email: body.user.email };
  }
  return { id: body.id, email: body.email };
}

async function insertAdminProfile(
  dbUrl: string,
  user: { id: string; email: string },
): Promise<void> {
  const sql = postgres(dbUrl, { prepare: false, max: 1 });
  try {
    await sql`
      INSERT INTO profiles (id, role, full_name, email, status)
      VALUES (${user.id}, ${"admin"}, ${ADMIN_FULL_NAME}, ${user.email}, ${"active"})
      ON CONFLICT (id) DO UPDATE
      SET role = EXCLUDED.role,
          full_name = EXCLUDED.full_name,
          email = EXCLUDED.email,
          status = EXCLUDED.status,
          updated_at = now()
    `;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main(): Promise<void> {
  if (!process.argv.includes("--yes")) {
    process.stderr.write(
      [
        "",
        "  Refusing to run without --yes flag.",
        "  This will DELETE ALL DATA from public tables AND all Supabase auth users,",
        "  then seed a default admin account.",
        "  Re-run with --yes to confirm:",
        "",
        "    pnpm --filter @aurahire/api seed-db -- --yes",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!dbUrl) throw new Error("DATABASE_URL is not set");
  if (!supabaseUrl) throw new Error("SUPABASE_URL is not set");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  const redactedDb = dbUrl.replace(/:[^:@/]+@/, ":****@");
  process.stdout.write(`Target DB:       ${redactedDb}\n`);
  process.stdout.write(`Target Supabase: ${supabaseUrl}\n`);
  process.stdout.write("\nStarting seed in 3 seconds — Ctrl+C to abort.\n");
  await new Promise((r) => setTimeout(r, 3000));

  process.stdout.write("\n→ Truncating public tables\n");
  const sql = postgres(dbUrl, { prepare: false, max: 1 });
  try {
    const tableList = PUBLIC_TABLES.join(", ");
    await sql.unsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
    process.stdout.write(`  ✓ Truncated ${PUBLIC_TABLES.length} tables\n`);
  } finally {
    await sql.end({ timeout: 5 });
  }

  process.stdout.write("\n→ Deleting Supabase auth users\n");
  const deleted = await deleteAllAuthUsers(supabaseUrl, serviceRoleKey);
  process.stdout.write(`  ✓ Deleted ${deleted} auth user(s)\n`);

  process.stdout.write("\n→ Creating admin auth user\n");
  const adminUser = await createAdminAuthUser(supabaseUrl, serviceRoleKey);
  process.stdout.write(`  ✓ Created auth.users row ${adminUser.id} (${adminUser.email})\n`);

  process.stdout.write("\n→ Inserting admin profile row\n");
  await insertAdminProfile(dbUrl, adminUser);
  process.stdout.write(`  ✓ profiles row upserted\n`);

  process.stdout.write("\n✓ Seed complete.\n");
  process.stdout.write(`  email:    ${ADMIN_EMAIL}\n`);
  process.stdout.write(`  password: ${ADMIN_PASSWORD}\n`);
  process.stdout.write(`  role:     admin\n`);
  process.exit(0);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `seed-db failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
