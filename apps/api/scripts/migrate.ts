/**
 * Neon migration runner.
 *
 * The 0000–0016 history is hand-authored SQL (only 0000 is in the drizzle
 * journal), so `drizzle-kit migrate` cannot apply it. This applies every
 * packages/db/drizzle/*.sql file in order against the Neon UNPOOLED endpoint,
 * recording applied files in __aurahire_migrations so re-runs are idempotent.
 *
 * Neon compatibility: the historical RLS migrations reference Supabase's
 * auth.uid(). We install a stub auth.uid() (returns NULL) so those CREATE
 * POLICY statements succeed; migration 0017 then drops all RLS + the stub.
 *
 * Run: pnpm --filter @aurahire/api migrate   (reads DATABASE_URL_UNPOOLED from .env)
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED (or DATABASE_URL) is required");
  process.exit(1);
}

const migrationsDir = path.resolve(__dirname, "../../../packages/db/drizzle");

async function main(): Promise<void> {
  const sql = postgres(url as string, {
    max: 1,
    prepare: false,
    onnotice: () => {},
  });
  try {
    // Neon compat: stub the Supabase-managed roles + auth.uid() so the historical
    // RLS/GRANT statements apply. Migration 0017 drops the RLS + auth.uid() stub;
    // the empty NOLOGIN stub roles are harmless and left in place.
    await sql.unsafe(
      "DO $r$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$; " +
        "DO $r$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$; " +
        "DO $r$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$; " +
        "CREATE SCHEMA IF NOT EXISTS auth; " +
        "CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $func$ SELECT NULL::uuid $func$;",
    );

    await sql`CREATE TABLE IF NOT EXISTS __aurahire_migrations (
      tag text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`;
    const appliedRows = await sql<{ tag: string }[]>`SELECT tag FROM __aurahire_migrations`;
    const applied = new Set(appliedRows.map((r) => r.tag));

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      const tag = file.replace(/\.sql$/, "");
      if (applied.has(tag)) {
        console.log(`  · skip ${tag}`);
        continue;
      }
      const ddl = readFileSync(path.join(migrationsDir, file), "utf8");
      process.stdout.write(`  → ${tag} ... `);
      await sql.begin(async (tx) => {
        await tx.unsafe(ddl);
        await tx`INSERT INTO __aurahire_migrations (tag) VALUES (${tag})`;
      });
      console.log("ok");
      count += 1;
    }
    console.log(`\n${count} applied / ${files.length} total migrations.`);
  } finally {
    await sql.end();
  }
}

main().catch((err: unknown) => {
  console.error("\nMigration failed:", err);
  process.exit(1);
});
