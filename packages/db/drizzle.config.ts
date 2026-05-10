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
    // For drizzle-kit generate, this is unused; for push/migrate it would be required.
    // We use Supabase MCP for application, so a placeholder is fine if env is missing.
    url:
      process.env.DATABASE_URL ??
      "postgresql://placeholder@localhost:5432/placeholder",
  },
  strict: true,
  verbose: true,
});
