/**
 * Reset DB: truncate every public-schema table and delete every Supabase auth user.
 *
 * Use this to start fresh in development. Requires DATABASE_URL, SUPABASE_URL,
 * and SUPABASE_SERVICE_ROLE_KEY in apps/api/.env.
 *
 * Run from repo root:
 *   pnpm --filter @aurahire/api reset-db -- --yes
 *
 * Without --yes the script refuses to run. After running, registered accounts are gone
 * and all profiles/companies/jobs/etc. are wiped - re-register to populate.
 */
import "reflect-metadata";
import postgres from "postgres";

// Order matters only for clarity - TRUNCATE ... CASCADE handles FK dependencies.
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

interface AuthUser {
  id: string;
  email?: string;
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
        `List users failed: ${listRes.status} ${listRes.statusText} - ${errBody}`,
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

async function main(): Promise<void> {
  if (!process.argv.includes("--yes")) {
    process.stderr.write(
      [
        "",
        "  Refusing to run without --yes flag.",
        "  This will DELETE ALL DATA from public tables AND all Supabase auth users.",
        "  Re-run with --yes to confirm:",
        "",
        "    pnpm --filter @aurahire/api reset-db -- --yes",
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
  process.stdout.write("\nStarting reset in 3 seconds - Ctrl+C to abort.\n");
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

  process.stdout.write("\n✓ Reset complete. Re-register to repopulate.\n");
  process.exit(0);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `reset-db failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
  );
  process.exit(1);
});
