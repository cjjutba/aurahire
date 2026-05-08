import { Module, forwardRef } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { ProfilesModule } from "../profiles/profiles.module";
import { ResumesModule } from "../resumes/resumes.module";
import { ScoringController } from "./scoring.controller";
import { ScoringRepository } from "./scoring.repository";
import { ScoringService } from "./scoring.service";
import { MatchPreviewPrecomputeProcessor } from "./processors/match-preview-precompute.processor";
import { MatchScoreProcessor } from "./processors/match-score.processor";
import { ProfileScoreRecomputeProcessor } from "./processors/profile-score-recompute.processor";

@Module({
  imports: [forwardRef(() => JobsModule), ProfilesModule, ResumesModule],
  controllers: [ScoringController],
  providers: [
    ScoringService,
    ScoringRepository,
    MatchPreviewPrecomputeProcessor,
    MatchScoreProcessor,
    ProfileScoreRecomputeProcessor,
  ],
  exports: [ScoringService, ScoringRepository],
})
export class ScoringModule {}
