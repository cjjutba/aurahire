import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { CacheModule } from "@nestjs/cache-manager";

import { DbModule } from "./db";
import { AuditModule } from "./audit";
import { EmailModule } from "./email";
import { AiModule } from "./ai";
import { StorageModule } from "./storage";
import { SupabaseAdminModule } from "./lib/supabase-admin";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";
import { RecruiterProfilesModule } from "./modules/recruiter-profiles/recruiter-profiles.module";
import { CandidateProfilesModule } from "./modules/candidate-profiles/candidate-profiles.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { ResumesModule } from "./modules/resumes/resumes.module";
import { ScoringModule } from "./modules/scoring/scoring.module";
import { ApplicationsModule } from "./modules/applications/applications.module";
import { BiasModule } from "./modules/bias/bias.module";
import { AdminModule } from "./modules/admin/admin.module";
import { SupabaseAuthGuard } from "./common/guards/supabase-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";

@Module({
  imports: [
    CacheModule.register({ isGlobal: true, ttl: 60_000 }),
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
    EmailModule,
    AiModule,
    StorageModule,
    SupabaseAdminModule,
    ProfilesModule,
    RecruiterProfilesModule,
    CandidateProfilesModule,
    JobsModule,
    ResumesModule,
    ScoringModule,
    ApplicationsModule,
    BiasModule,
    AdminModule,
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
