import { forwardRef, Module } from "@nestjs/common";

import { DbModule } from "../../db";
import { ActiveCompanyGuard } from "../../common/guards/active-company.guard";
import { ProfilesModule } from "../profiles/profiles.module";
import { CompaniesController } from "./companies.controller";
import { CompaniesRepository } from "./companies.repository";
import { CompaniesService } from "./companies.service";
import { CompanyMembersRepository } from "./company-members.repository";

/**
 * Phase 2b: full controller + service for the companies feature lands here.
 *
 * `CompanyMembersRepository` is exported so `ActiveCompanyGuard` (registered
 * by other modules later) and the InvitationsModule can both consume it.
 *
 * Forward-ref on ProfilesModule because ProfilesModule depends on this
 * module for `CompanyMembersRepository` — both halves need each other's
 * repositories.
 *
 * `DbModule` is imported defensively even though it's @Global — if the
 * global decorator is ever removed, this module keeps working.
 */
@Module({
  imports: [DbModule, forwardRef(() => ProfilesModule)],
  controllers: [CompaniesController],
  providers: [
    CompaniesService,
    CompaniesRepository,
    CompanyMembersRepository,
    // ActiveCompanyGuard is consumed via @UseGuards() on this module's
    // controller — must be DI-instantiable here. Re-exported so other
    // modules that use the same @UseGuards pattern (Invitations, Profiles)
    // pick it up via this import.
    ActiveCompanyGuard,
  ],
  exports: [
    CompaniesService,
    CompaniesRepository,
    CompanyMembersRepository,
    ActiveCompanyGuard,
  ],
})
export class CompaniesModule {}
