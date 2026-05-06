import { forwardRef, Module } from "@nestjs/common";

import { CompaniesModule } from "../companies/companies.module";
import { ProfilesController } from "./profiles.controller";
import { ProfilesRepository } from "./profiles.repository";
import { ProfilesService } from "./profiles.service";

/**
 * ProfilesModule depends on `CompanyMembersRepository` (memberships listing,
 * active-membership validation in `updateMyProfile`). CompaniesModule in turn
 * depends on ProfilesModule's repo for the recruiter-becomes-owner side of
 * `POST /companies`. The cycle is broken with forwardRef on both ends.
 */
@Module({
  imports: [forwardRef(() => CompaniesModule)],
  controllers: [ProfilesController],
  providers: [ProfilesService, ProfilesRepository],
  exports: [ProfilesService, ProfilesRepository],
})
export class ProfilesModule {}
