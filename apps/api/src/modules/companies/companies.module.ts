import { forwardRef, Module } from "@nestjs/common";

import { DbModule } from "../../db";
import { ProfilesModule } from "../profiles/profiles.module";
import { CompaniesController } from "./companies.controller";
import { CompaniesRepository } from "./companies.repository";
import { CompaniesService } from "./companies.service";
import { CompanyMembersRepository } from "./company-members.repository";

/**
 * Companies feature module. Owns the controller/service for company CRUD
 * + member management plus the `CompanyMembersRepository` consumed by the
 * globally-registered `ActiveCompanyGuard`.
 *
 * `CompanyMembersRepository` is exported because:
 *   - `ActiveCompanyGuard` (registered as APP_GUARD in `app.module.ts`)
 *     resolves the repo through the root injector via this export
 *   - InvitationsModule joins membership writes through the same repo
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
  providers: [CompaniesService, CompaniesRepository, CompanyMembersRepository],
  exports: [CompaniesService, CompaniesRepository, CompanyMembersRepository],
})
export class CompaniesModule {}
