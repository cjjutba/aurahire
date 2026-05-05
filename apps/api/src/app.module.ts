import { Logger, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { CacheModule } from "@nestjs/cache-manager";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "nestjs-throttler-storage-redis";
import Redis from "ioredis";
import { Keyv } from "keyv";
import KeyvRedis from "@keyv/redis";

import { DbModule } from "./db";
import { AuditModule } from "./audit";
import { EmailModule } from "./email";
import { AiModule } from "./ai";
import { StorageModule } from "./storage";
import { SupabaseAdminModule } from "./lib/supabase-admin";
import { CacheModule as AppCacheModule } from "./cache";
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
import { InterviewsModule } from "./modules/interviews/interviews.module";
import { OffersModule } from "./modules/offers/offers.module";
import { AdminModule } from "./modules/admin/admin.module";
import { QueueModule } from "./queue";
import { CronModule } from "./cron";
import { SupabaseAuthGuard } from "./common/guards/supabase-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const url = config.get<string>("REDIS_URL") ?? "redis://localhost:6379";
        const logger = new Logger("CacheModule");
        try {
          // Use @keyv/redis as the cache-manager v7 store adapter. We probe the
          // connection here so a Redis outage surfaces clearly on boot — the
          // backend still starts, but cached aggregations fall back to memory.
          const keyvRedis = new KeyvRedis(url, {
            throwOnConnectError: true,
            connectionTimeout: 5000,
          });
          const keyv = new Keyv({ store: keyvRedis, namespace: "aurahire" });
          // Force a connection probe; @keyv/redis lazy-connects otherwise.
          await keyv.get("__cache_health_probe__");
          logger.log(`CacheModule: connected to Redis at ${url}`);
          return { stores: [keyv], ttl: 60_000 };
        } catch (err) {
          logger.warn(
            `CacheModule: Redis unreachable at ${url} (${(err as Error).message}); falling back to in-memory store. Cached aggregations will not survive restarts.`,
          );
          return { ttl: 60_000 };
        }
      },
    }),
    AppCacheModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>("REDIS_URL") ?? "redis://localhost:6379";
        return {
          throttlers: [
            // Default per-IP global limit — basic abuse protection.
            { name: "default", limit: 100, ttl: 60_000 },
            // Named throttlers must be registered globally so that the
            // @Throttle({ <name>: ... }) decorators on specific endpoints can
            // override them. @nestjs/throttler applies every registered
            // throttler to every route by default, so the global limits here
            // are intentionally permissive — the actual restrictive limits
            // live on the @Throttle decorators of the routes that need them
            // (auth controller, scoring/profile/compute, resumes/upload).
            { name: "auth", limit: 1000, ttl: 60_000 },
            { name: "profileCompute", limit: 1000, ttl: 60_000 },
            { name: "resumeUpload", limit: 1000, ttl: 60 * 60_000 },
          ],
          storage: new ThrottlerStorageRedisService(new Redis(url)),
        };
      },
    }),
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
    QueueModule,
    CronModule,
    ProfilesModule,
    RecruiterProfilesModule,
    CandidateProfilesModule,
    JobsModule,
    ResumesModule,
    ScoringModule,
    ApplicationsModule,
    BiasModule,
    InterviewsModule,
    OffersModule,
    AdminModule,
    HealthModule,
    AuthModule,
  ],
  providers: [
    // ThrottlerGuard runs FIRST so unauthenticated brute-force (login spam,
    // upload-storms) is rate-limited before auth even fires.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
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
