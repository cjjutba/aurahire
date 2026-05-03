import { Module } from "@nestjs/common";

import { ApplicationsModule } from "../applications/applications.module";
import { AuthModule } from "../auth/auth.module";
import { BiasModule } from "../bias/bias.module";
import { JobsModule } from "../jobs/jobs.module";
import { ScoringModule } from "../scoring/scoring.module";

import { AdminStatsController } from "./controllers/admin-stats.controller";
import { AdminUsersController } from "./controllers/admin-users.controller";
import { AdminJobsController } from "./controllers/admin-jobs.controller";
import { AdminApplicationsController } from "./controllers/admin-applications.controller";
import { AdminConfigController } from "./controllers/admin-config.controller";
import { AdminAuditController } from "./controllers/admin-audit.controller";
import { AdminAnalyticsController } from "./controllers/admin-analytics.controller";
import { AdminBiasMonitorController } from "./controllers/admin-bias-monitor.controller";
import { AdminQueueController } from "./controllers/admin-queue.controller";

import { AdminStatsService } from "./services/admin-stats.service";
import { AdminUsersService } from "./services/admin-users.service";
import { AdminJobsService } from "./services/admin-jobs.service";
import { AdminApplicationsService } from "./services/admin-applications.service";
import { AdminConfigService } from "./services/admin-config.service";
import { AdminAuditService } from "./services/admin-audit.service";
import { AdminAnalyticsService } from "./services/admin-analytics.service";
import { AdminBiasMonitorService } from "./services/admin-bias-monitor.service";
import { AdminQueueService } from "./services/admin-queue.service";

import { AdminStatsRepository } from "./repositories/admin-stats.repository";
import { AdminUsersRepository } from "./repositories/admin-users.repository";
import { AdminApplicationsRepository } from "./repositories/admin-applications.repository";
import { AdminConfigRepository } from "./repositories/admin-config.repository";
import { AdminAuditRepository } from "./repositories/admin-audit.repository";
import { AdminAnalyticsRepository } from "./repositories/admin-analytics.repository";
import { AdminBiasMonitorRepository } from "./repositories/admin-bias-monitor.repository";

import { RescoreBatchProcessor } from "./processors/rescore-batch.processor";

@Module({
  imports: [JobsModule, BiasModule, ApplicationsModule, AuthModule, ScoringModule],
  controllers: [
    AdminStatsController,
    AdminUsersController,
    AdminJobsController,
    AdminApplicationsController,
    AdminConfigController,
    AdminAuditController,
    AdminAnalyticsController,
    AdminBiasMonitorController,
    AdminQueueController,
  ],
  providers: [
    AdminStatsService,
    AdminUsersService,
    AdminJobsService,
    AdminApplicationsService,
    AdminConfigService,
    AdminAuditService,
    AdminAnalyticsService,
    AdminBiasMonitorService,
    AdminQueueService,
    RescoreBatchProcessor,
    AdminStatsRepository,
    AdminUsersRepository,
    AdminApplicationsRepository,
    AdminConfigRepository,
    AdminAuditRepository,
    AdminAnalyticsRepository,
    AdminBiasMonitorRepository,
  ],
})
export class AdminModule {}
