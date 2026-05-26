import { Module } from "@nestjs/common";

import { ApplicationsModule } from "../applications/applications.module";
import { InterviewVenuesModule } from "../interview-venues/interview-venues.module";
import { JobsModule } from "../jobs/jobs.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ProfilesModule } from "../profiles/profiles.module";
import { ScoringModule } from "../scoring/scoring.module";

import { InterviewsController } from "./interviews.controller";
import { InterviewsRepository } from "./interviews.repository";
import { InterviewsService } from "./interviews.service";

@Module({
  imports: [
    ApplicationsModule,
    InterviewVenuesModule,
    JobsModule,
    NotificationsModule,
    ProfilesModule,
    // ScoringModule for findMatchScoreByApplicationId in the score-based
    // interview-eligibility gate (May 2026 panel). The threshold itself
    // is read directly via Drizzle to avoid a cyclic module-load with
    // AdminModule.
    ScoringModule,
  ],
  controllers: [InterviewsController],
  providers: [InterviewsService, InterviewsRepository],
  exports: [InterviewsService, InterviewsRepository],
})
export class InterviewsModule {}
