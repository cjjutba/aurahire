import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@aurahire/db";

export const DRIZZLE_CLIENT = Symbol("DRIZZLE_CLIENT");
export type DrizzleClient = PostgresJsDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const connectionString = config.getOrThrow<string>("DATABASE_URL");
        const client = postgres(connectionString, {
          max: 10,
          idle_timeout: 30,
          connect_timeout: 10,
          prepare: false, // Supabase pgbouncer transaction mode requires prepare: false
        });
        // Opt-in SQL tracing — set DRIZZLE_DEBUG=1 only when investigating query
        // shape. Always-on dev logging drowns request traces with raw SQL.
        const enableLogger = process.env.DRIZZLE_DEBUG === "1";
        return drizzle(client, { schema, logger: enableLogger });
      },
    },
  ],
  exports: [DRIZZLE_CLIENT],
})
export class DbModule {}
