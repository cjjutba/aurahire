import { Module } from "@nestjs/common";

import { ApplicationsModule } from "../applications/applications.module";
import { JobsModule } from "../jobs/jobs.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ProfilesModule } from "../profiles/profiles.module";

import { InterviewsController } from "./interviews.controller";
import { InterviewsRepository } from "./interviews.repository";
import { InterviewsService } from "./interviews.service";

@Module({
  imports: [ApplicationsModule, JobsModule, NotificationsModule, ProfilesModule],
  controllers: [InterviewsController],
  providers: [InterviewsService, InterviewsRepository],
  exports: [InterviewsService, InterviewsRepository],
})
export class InterviewsModule {}
