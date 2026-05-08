import { Module } from "@nestjs/common";

import { ApplicationsModule } from "../applications/applications.module";
import { JobsModule } from "../jobs/jobs.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ProfilesModule } from "../profiles/profiles.module";

import { OffersController } from "./offers.controller";
import { OffersRepository } from "./offers.repository";
import { OffersService } from "./offers.service";

@Module({
  imports: [ApplicationsModule, JobsModule, NotificationsModule, ProfilesModule],
  controllers: [OffersController],
  providers: [OffersService, OffersRepository],
  exports: [OffersService, OffersRepository],
})
export class OffersModule {}
