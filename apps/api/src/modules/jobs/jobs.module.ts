import { Module, forwardRef } from "@nestjs/common";

import { ProfilesModule } from "../profiles/profiles.module";
import { BiasModule } from "../bias/bias.module";
import { JobsController } from "./jobs.controller";
import { JobsRepository } from "./jobs.repository";
import { JobsService } from "./jobs.service";

@Module({
  imports: [ProfilesModule, forwardRef(() => BiasModule)],
  controllers: [JobsController],
  providers: [JobsService, JobsRepository],
  exports: [JobsService, JobsRepository],
})
export class JobsModule {}
