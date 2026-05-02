import { Module } from "@nestjs/common";
import { ProfilesModule } from "../profiles/profiles.module";
import { CandidateProfilesController } from "./candidate-profiles.controller";
import { CandidateProfilesService } from "./candidate-profiles.service";

@Module({
  imports: [ProfilesModule],
  controllers: [CandidateProfilesController],
  providers: [CandidateProfilesService],
})
export class CandidateProfilesModule {}
