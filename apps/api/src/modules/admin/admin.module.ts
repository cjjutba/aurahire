import { Module } from "@nestjs/common";

import { ApplicationsModule } from "../applications/applications.module";
import { AuthModule } from "../auth/auth.module";
import { BiasModule } from "../bias/bias.module";
import { JobsModule } from "../jobs/jobs.module";

import { AdminStatsController } from "./controllers/admin-stats.controller";
import { AdminUsersController } from "./controllers/admin-users.controller";
import { AdminJobsController } from "./controllers/admin-jobs.controller";

import { AdminStatsService } from "./services/admin-stats.service";
import { AdminUsersService } from "./services/admin-users.service";
import { AdminJobsService } from "./services/admin-jobs.service";

import { AdminStatsRepository } from "./repositories/admin-stats.repository";
import { AdminUsersRepository } from "./repositories/admin-users.repository";

@Module({
  imports: [JobsModule, BiasModule, ApplicationsModule, AuthModule],
  controllers: [
    AdminStatsController,
    AdminUsersController,
    AdminJobsController,
  ],
  providers: [
    AdminStatsService,
    AdminUsersService,
    AdminJobsService,
    AdminStatsRepository,
    AdminUsersRepository,
  ],
})
export class AdminModule {}
