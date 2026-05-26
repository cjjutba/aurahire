/**
 * Backfill match_scores + match_score_previews rows that the AI
 * returned with fewer than the four canonical components (skills,
 * experience, education, cultural_fit). Insert zero-placeholder
 * components for the missing ones so the recruiter / candidate
 * breakdown UI always renders four bars.
 *
 * Triggered by the May 2026 panel-prep audit: the prompt asks for all
 * four components, but the schema permits a shorter array, and ~80% of
 * recent rows had only `skills`. The source bug is fixed in
 * apps/api/src/ai/score-match.service.ts (defensive backfill before
 * persistence); this script repairs already-stored rows.
 *
 * The placeholder uses score=0 with one neutral evidence row that
 * explains the gap honestly — never fabricates score points.
 *
 * Idempotent: re-running picks up nothing (rows are skipped once they
 * have all four component names).
 *
 * Requires DATABASE_URL in apps/api/.env.
 *
 * Run from repo root:
 *   pnpm --filter @aurahire/api backfill-match-score-components -- --yes
 *
 * Pass without --yes for a DRY-RUN that reports the count without
 * mutating.
 */
import "reflect-metadata";
import postgres from "postgres";

const REQUIRED_COMPONENT_NAMES = [
  "skills",
  "experience",
  "education",
  "cultural_fit",
] as const;

type ComponentName = (typeof REQUIRED_COMPONENT_NAMES)[number];

const DEFAULT_WEIGHTS: Record<ComponentName, number> = {
  skills: 40,
  experience: 35,
  education: 15,
  cultural_fit: 10,
};

interface StoredComponent {
  name: ComponentName;
  score: number;
  max: number;
  weight: number;
  explanation: string;
  evidence: Array<{
    excerpt: string;
    source: string;
    relevance: "positive" | "negative" | "neutral";
    contribution_points: number;
    reasoning?: string;
  }>;
}

function placeholder(name: ComponentName, weight: number): StoredComponent {
  return {
    name,
    score: 0,
    max: weight,
    weight,
    explanation:
      "Could not be evaluated from the candidate's resume content — the AI did not extract a signal for this component on this run.",
    evidence: [
      {
        excerpt:
          "Insufficient signal in the redacted resume content to score this component.",
        source: "System note",
        relevance: "neutral",
        contribution_points: 0,
        reasoning:
          "Placeholder evidence inserted by the platform when the AI returned an incomplete component breakdown; surfaces the gap honestly instead of silently dropping the bar.",
      },
    ],
  };
}

function fillMissing(
  components: StoredComponent[],
  weights: Record<ComponentName, number>,
): { padded: StoredComponent[]; added: ComponentName[] } {
  const byName = new Map(components.map((c) => [c.name, c]));
  const added: ComponentName[] = [];
  const padded = REQUIRED_COMPONENT_NAMES.map((n) => {
    const present = byName.get(n);
    if (present) return present;
    added.push(n);
    return placeholder(n, weights[n]);
  });
  return { padded, added };
}

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
    // Pull the active scoring weights so the placeholder bars have the
    // right max/weight for the deployment's current configuration.
    let weights = { ...DEFAULT_WEIGHTS };
    try {
      const [config] = await sql<
        Array<{ match_weights: Record<string, number> }>
      >`
        SELECT match_weights
        FROM scoring_config
        WHERE is_active = true
        LIMIT 1
      `;
      if (config?.match_weights) {
        for (const n of REQUIRED_COMPONENT_NAMES) {
          if (typeof config.match_weights[n] === "number") {
            weights[n] = config.match_weights[n];
          }
        }
      }
    } catch (err) {
      console.warn(
        `[backfill] could not read scoring_config — using defaults. ${(err as Error).message}`,
      );
    }

    console.log(
      `[backfill] using weights: ${JSON.stringify(weights)} (apply=${apply})`,
    );

    for (const table of ["match_scores", "match_score_previews"] as const) {
      console.log(`\n[backfill] scanning ${table}…`);
      const rows = await sql<
        Array<{ id: string; components: StoredComponent[] }>
      >`
        SELECT id, components
        FROM ${sql(table)}
        WHERE jsonb_array_length(components) < ${REQUIRED_COMPONENT_NAMES.length}
        ORDER BY created_at ASC
      `;
      console.log(`[backfill] ${table}: ${rows.length} row(s) need padding`);
      if (rows.length === 0) continue;
      if (!apply) {
        for (const r of rows.slice(0, 5)) {
          const names = r.components.map((c) => c.name).join(", ");
          console.log(`  - ${r.id} has [${names}]`);
        }
        if (rows.length > 5) {
          console.log(`  ... and ${rows.length - 5} more`);
        }
        continue;
      }

      let updated = 0;
      for (const r of rows) {
        const { padded, added } = fillMissing(r.components, weights);
        // Important: a naive `${JSON.stringify(arr)}::jsonb` round-trip
        // double-encodes the value via postgres.js — the driver wraps
        // the JS string in a JSONB string scalar and ::jsonb then
        // parses THAT as a JSONB string, leaving the column with
        // jsonb_typeof='string' instead of 'array'.
        //
        // `sql.json(...)` is the supported path — it serializes the JS
        // value once and binds it as the jsonb parameter. The library's
        // typings are too narrow for arrays so cast through `any`; the
        // post-update typeof check below is the real guarantee.
        await sql`
          UPDATE ${sql(table)}
          SET components = ${sql.json(padded as any)}
          WHERE id = ${r.id}
        `;
        // Defensive sanity check — every row we write must end with a
        // jsonb_typeof=array. If the driver / cast ever regresses, this
        // SELECT will throw rather than corrupt rows silently.
        const [check] = await sql<Array<{ t: string }>>`
          SELECT jsonb_typeof(components) AS t
          FROM ${sql(table)}
          WHERE id = ${r.id}
        `;
        if (check?.t !== "array") {
          throw new Error(
            `[backfill] post-update row ${r.id} has jsonb_typeof=${check?.t}; refusing to corrupt data`,
          );
        }
        updated += 1;
        if (updated <= 5) {
          console.log(`  - ${r.id} padded with [${added.join(", ")}]`);
        }
      }
      console.log(`[backfill] ${table}: padded ${updated} row(s)`);
    }

    if (!apply) {
      console.log(
        "\n[backfill] DRY RUN — pass --yes to apply the backfill.",
      );
    } else {
      console.log("\n[backfill] OK — done.");
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[backfill-match-score-components] FAILED:", err);
  process.exit(1);
});
