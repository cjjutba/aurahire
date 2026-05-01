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
        return drizzle(client, { schema, logger: process.env.NODE_ENV !== "production" });
      },
    },
  ],
  exports: [DRIZZLE_CLIENT],
})
export class DbModule {}
