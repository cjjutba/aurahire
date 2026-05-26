/**
 * Backfill `evidence_excerpts.excerpt_redacted` for historical rows.
 *
 * The May 2026 thesis panel revision added the `excerpt_redacted` column —
 * a recruiter-safe variant of the verbatim resume quote. New rows always
 * populate both columns at write time. This script populates the redacted
 * column for rows written before the change so existing pipelines render
 * correctly in the recruiter UI.
 *
 * Strategy:
 *   - Page through all rows with excerpt_redacted IS NULL.
 *   - For each, compute `redactExcerptDeterministic(excerpt_text)`.
 *   - Write back.
 *
 * Idempotent: re-running picks up nothing.
 *
 * Requires DATABASE_URL in apps/api/.env.
 *
 * Run from repo root:
 *   pnpm --filter @aurahire/api backfill-redacted-excerpts -- --yes
 */
import "reflect-metadata";
import postgres from "postgres";
import { redactExcerptDeterministic } from "../src/ai/redact-text-deterministic";

const PAGE_SIZE = 500;

function loadEnv(): { databaseUrl: string } {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required in apps/api/.env");
  }
  return { databaseUrl };
}

interface Row {
  id: string;
  excerpt_text: string;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--yes");
  const { databaseUrl } = loadEnv();
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  let totalProcessed = 0;

  try {
    while (true) {
      const rows = await sql<Row[]>`
        SELECT id, excerpt_text
        FROM evidence_excerpts
        WHERE excerpt_redacted IS NULL
        ORDER BY created_at ASC
        LIMIT ${PAGE_SIZE}
      `;
      if (rows.length === 0) break;

      console.log(
        `[backfill-redacted-excerpts] page of ${rows.length} (total processed so far: ${totalProcessed})`,
      );
      if (!apply) {
        console.log(
          "[backfill-redacted-excerpts] DRY RUN — pass --yes to apply the backfill.",
        );
        for (const row of rows.slice(0, 3)) {
          const sample = redactExcerptDeterministic(row.excerpt_text);
          console.log(`  - ${row.id}: "${sample.slice(0, 80)}..."`);
        }
        return;
      }

      // Batch update each page in a single transaction.
      const updates = rows.map((r) => ({
        id: r.id,
        excerptRedacted: redactExcerptDeterministic(r.excerpt_text),
      }));
      await sql.begin(async (tx) => {
        for (const u of updates) {
          await tx`
            UPDATE evidence_excerpts
            SET excerpt_redacted = ${u.excerptRedacted}
            WHERE id = ${u.id}
          `;
        }
      });
      totalProcessed += rows.length;

      // Safety stop if the page didn't fill — we're done.
      if (rows.length < PAGE_SIZE) break;
    }

    console.log(
      `[backfill-redacted-excerpts] OK — backfilled ${totalProcessed} row(s).`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[backfill-redacted-excerpts] FAILED:", err);
  process.exit(1);
});
