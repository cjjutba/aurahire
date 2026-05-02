import { Module } from "@nestjs/common";
import { ProfilesModule } from "../profiles/profiles.module";
import { RecruiterProfilesController } from "./recruiter-profiles.controller";
import { RecruiterProfilesService } from "./recruiter-profiles.service";

@Module({
  imports: [ProfilesModule],
  controllers: [RecruiterProfilesController],
  providers: [RecruiterProfilesService],
})
export class RecruiterProfilesModule {}
