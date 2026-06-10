/**
 * Migrate-remove-screening: data migration for the May 2026 thesis panel
 * revision that eliminates the "screening" application status.
 *
 * Steps (transactional):
 *   1. Find every applications row where status='screening'.
 *   2. UPDATE each to status='applied'.
 *   3. Write one audit_logs row per migrated app with
 *      action='application.migrated_from_screening' and the from/to in
 *      `details`.
 *
 * This MUST be run BEFORE pushing the new schema (which drops 'screening'
 * from the APPLICATION_STATUS enum). Once the schema constraint tightens,
 * a row with status='screening' would block writes.
 *
 * Requires DATABASE_URL in apps/api/.env.
 *
 * Run from repo root:
 *   pnpm --filter @aurahire/api migrate-remove-screening -- --yes
 *
 * Without --yes the script lists matching rows but does NOT mutate.
 *
 * Idempotent: re-running after migration is a no-op (no rows match).
 */
import "reflect-metadata";
import postgres from "postgres";

function loadEnv(): { databaseUrl: string } {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required in apps/api/.env");
  }
  return { databaseUrl };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--yes");

  const { databaseUrl } = loadEnv();
  const sql = postgres(databaseUrl, { max: 1, prepare: false });

  try {
    const rows = await sql<
      Array<{ id: string; candidate_id: string; job_id: string }>
    >`
      SELECT id, candidate_id, job_id
      FROM applications
      WHERE status = 'screening'
    `;

    if (rows.length === 0) {
      console.log(
        "[migrate-remove-screening] No applications with status='screening'. Nothing to do.",
      );
      return;
    }

    console.log(
      `[migrate-remove-screening] Found ${rows.length} application(s) with status='screening'.`,
    );
    if (!apply) {
      console.log(
        "[migrate-remove-screening] DRY RUN - pass --yes to apply the migration.",
      );
      for (const row of rows.slice(0, 10)) {
        console.log(`  - application ${row.id} (candidate ${row.candidate_id})`);
      }
      if (rows.length > 10) {
        console.log(`  ... and ${rows.length - 10} more`);
      }
      return;
    }

    await sql.begin(async (tx) => {
      // 1. Update applications.
      await tx`
        UPDATE applications
        SET status = 'applied', updated_at = NOW()
        WHERE status = 'screening'
      `;
      // 2. Audit one row per migrated application.
      await tx`
        INSERT INTO audit_logs (actor_type, action, entity_type, entity_id, details)
        SELECT
          'system',
          'application.migrated_from_screening',
          'application',
          a.id,
          jsonb_build_object(
            'fromStatus', 'screening',
            'toStatus', 'applied',
            'reason', 'Panel revision May 2026 - screening stage removed.'
          )
        FROM applications a
        WHERE a.id = ANY(${rows.map((r) => r.id)}::uuid[])
      `;
    });

    console.log(
      `[migrate-remove-screening] OK - migrated ${rows.length} application(s) and wrote ${rows.length} audit row(s).`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[migrate-remove-screening] FAILED:", err);
  process.exit(1);
});
