/**
 * Epic 1 smoke test — verifies the Neon + Upstash cutover end-to-end:
 *  - Neon POOLED endpoint (the runtime path) connects with prepare:false
 *  - schema is present and RLS is fully removed
 *  - Upstash Redis (rediss://) round-trips set/get/del
 *
 * Run: pnpm --filter @aurahire/api smoke:infra
 */
import Redis from "ioredis";
import postgres from "postgres";

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  if (!dbUrl || !redisUrl) {
    throw new Error("DATABASE_URL and REDIS_URL are required");
  }

  // 1) Neon pooled connection (runtime path: pooler + prepare:false)
  const sql = postgres(dbUrl, { max: 1, prepare: false });

  const tables =
    (await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`)[0]?.n ?? -1;
  const policies =
    (await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'public'`)[0]?.n ?? -1;
  const rls_on =
    (await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity`)[0]?.n ?? -1;
  const profiles =
    (await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM profiles`)[0]?.n ?? -1;
  await sql.end();
  console.log(
    `Neon (pooled, prepare:false): ${tables} tables · ${policies} RLS policies · ${rls_on} tables with RLS enabled · profiles rows=${profiles}`,
  );

  // 2) Upstash Redis (rediss:// = TLS)
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
  await redis.set("__epic1_smoke__", "ok", "EX", 30);
  const value = await redis.get("__epic1_smoke__");
  await redis.del("__epic1_smoke__");
  redis.disconnect();
  console.log(`Upstash Redis (rediss://): set/get/del → "${value}"`);

  const passed = tables >= 20 && policies === 0 && rls_on === 0 && value === "ok";
  console.log(passed ? "\n✅ Epic 1 smoke test PASSED" : "\n❌ Epic 1 smoke test FAILED");
  process.exit(passed ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
