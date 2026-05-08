import { Module } from "@nestjs/common";

import { AuditModule } from "../../audit";
import { CacheModule } from "../../cache";
import { InterviewVenuesController } from "./interview-venues.controller";
import { InterviewVenuesRepository } from "./interview-venues.repository";
import { InterviewVenuesService } from "./interview-venues.service";

@Module({
  imports: [AuditModule, CacheModule],
  controllers: [InterviewVenuesController],
  providers: [InterviewVenuesService, InterviewVenuesRepository],
  exports: [InterviewVenuesService, InterviewVenuesRepository],
})
export class InterviewVenuesModule {}
