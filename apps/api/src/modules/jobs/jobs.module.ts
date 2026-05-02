import { Module } from "@nestjs/common";

import { ProfilesModule } from "../profiles/profiles.module";
import { JobsController } from "./jobs.controller";
import { JobsRepository } from "./jobs.repository";
import { JobsService } from "./jobs.service";

@Module({
  imports: [ProfilesModule],
  controllers: [JobsController],
  providers: [JobsService, JobsRepository],
  exports: [JobsService, JobsRepository],
})
export class JobsModule {}
