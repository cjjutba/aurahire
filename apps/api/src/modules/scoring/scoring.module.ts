import { Module } from "@nestjs/common";
import { ProfilesModule } from "../profiles/profiles.module";
import { ResumesModule } from "../resumes/resumes.module";
import { ScoringController } from "./scoring.controller";
import { ScoringRepository } from "./scoring.repository";
import { ScoringService } from "./scoring.service";

@Module({
  imports: [ProfilesModule, ResumesModule],
  controllers: [ScoringController],
  providers: [ScoringService, ScoringRepository],
  exports: [ScoringService, ScoringRepository],
})
export class ScoringModule {}
