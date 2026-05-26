import { forwardRef, Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OffersModule } from "../offers/offers.module";
import { ProfilesModule } from "../profiles/profiles.module";
import { ResumesModule } from "../resumes/resumes.module";
import { ScoringModule } from "../scoring/scoring.module";
import { ApplicationsController } from "./applications.controller";
import { ApplicationsRepository } from "./applications.repository";
import { ApplicationsService } from "./applications.service";

@Module({
  imports: [
    JobsModule,
    NotificationsModule,
    ProfilesModule,
    ResumesModule,
    // forwardRef: ScoringModule's MatchScoreProcessor depends back on
    // ApplicationsService for the score-based auto-reject hook.
    forwardRef(() => ScoringModule),
    forwardRef(() => OffersModule),
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, ApplicationsRepository],
  exports: [ApplicationsService, ApplicationsRepository],
})
export class ApplicationsModule {}
