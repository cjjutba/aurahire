import { Module } from "@nestjs/common";
import { ProfilesModule } from "../profiles/profiles.module";
import { ResumesModule } from "../resumes/resumes.module";
import { ScoringModule } from "../scoring/scoring.module";
import { CandidateProfilesController } from "./candidate-profiles.controller";
import { CandidateProfilesService } from "./candidate-profiles.service";

@Module({
  imports: [ProfilesModule, ResumesModule, ScoringModule],
  controllers: [CandidateProfilesController],
  providers: [CandidateProfilesService],
})
export class CandidateProfilesModule {}
