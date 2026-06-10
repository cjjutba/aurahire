import { defineConfig } from "drizzle-kit";
import { config as loadEnv } from "dotenv";
import path from "node:path";

// Load DATABASE_URL from apps/api/.env (single source for both runtime + tooling)
loadEnv({ path: path.resolve(__dirname, "../../apps/api/.env") });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // drizzle-kit (generate/studio) connects via the Neon UNPOOLED (direct)
    // endpoint — DDL + introspection must not go through the PgBouncer pooler.
    // The 0000–0016 history is applied by scripts/migrate.ts (hand-authored SQL,
    // no drizzle journal entries beyond 0000); use `drizzle-kit generate` going
    // forward for new schema changes.
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      "postgresql://placeholder@localhost:5432/placeholder",
  },
  strict: true,
  verbose: true,
});
