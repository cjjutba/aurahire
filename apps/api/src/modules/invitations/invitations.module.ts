import { Module } from "@nestjs/common";

import { CompaniesModule } from "../companies/companies.module";
import { ProfilesModule } from "../profiles/profiles.module";
import { InvitationsController } from "./invitations.controller";
import { InvitationsService } from "./invitations.service";

/**
 * Invitations live conceptually inside companies (rows in `company_members`)
 * but get their own controller because the public preview + token-based
 * accept/decline flows have a different auth shape than companies/me/*.
 *
 * Imports CompaniesModule for `CompanyMembersRepository` + `CompaniesRepository`.
 * Imports ProfilesModule for `ProfilesRepository` (needed to set
 * `last_active_company_id` on accept).
 */
@Module({
  imports: [CompaniesModule, ProfilesModule],
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
