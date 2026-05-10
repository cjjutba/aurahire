import { Module } from "@nestjs/common";

import { ProfilesModule } from "../profiles/profiles.module";
import { AdminFeedbackController } from "./admin-feedback.controller";
import { FeedbackController } from "./feedback.controller";
import { FeedbackRepository } from "./feedback.repository";
import { FeedbackService } from "./feedback.service";

@Module({
  imports: [ProfilesModule],
  controllers: [FeedbackController, AdminFeedbackController],
  providers: [FeedbackService, FeedbackRepository],
  exports: [FeedbackService, FeedbackRepository],
})
export class FeedbackModule {}
