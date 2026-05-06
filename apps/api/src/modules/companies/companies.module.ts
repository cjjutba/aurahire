import { Module } from "@nestjs/common";

import { DbModule } from "../../db";
import { CompanyMembersRepository } from "./company-members.repository";

/**
 * Phase 2a: this module exists only to provide `CompanyMembersRepository`
 * to `ActiveCompanyGuard` and (eventually) the companies + invitations
 * controllers. The controllers + service land in Phase 2b.
 *
 * `DbModule` is imported defensively even though it's @Global — if the
 * global decorator is ever removed, this module keeps working.
 */
@Module({
  imports: [DbModule],
  providers: [CompanyMembersRepository],
  exports: [CompanyMembersRepository],
})
export class CompaniesModule {}
