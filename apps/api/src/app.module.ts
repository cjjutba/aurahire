import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";

import { DbModule } from "./db";
import { AuditModule } from "./audit";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";
import { SupabaseAuthGuard } from "./common/guards/supabase-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== "production"
            ? { target: "pino-pretty", options: { singleLine: true, translateTime: "SYS:HH:MM:ss" } }
            : undefined,
        level: process.env.LOG_LEVEL ?? "info",
        autoLogging: true,
        redact: ["req.headers.authorization", "req.headers.cookie"],
        customProps: (req) => ({ requestId: (req as { id?: string }).id }),
      },
    }),
    DbModule,
    AuditModule,
    ProfilesModule,
    HealthModule,
    AuthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
