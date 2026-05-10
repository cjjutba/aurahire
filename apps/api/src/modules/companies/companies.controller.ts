import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import type { AuthUser } from "@aurahire/shared";

import {
  ActiveCompany,
  type ActiveCompanyContext,
} from "../../common/decorators/active-company.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequireCompanyRole } from "../../common/decorators/require-company-role.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { SkipActiveCompany } from "../../common/decorators/skip-active-company.decorator";

import { CompaniesService } from "./companies.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { DeleteCompanyDto, UpdateCompanyDto } from "./dto/update-company.dto";
import { InviteMemberDto } from "./dto/invite-member.dto";
import { TransferOwnershipDto, UpdateMemberDto } from "./dto/update-member.dto";
import {
  CompanyEnvelopeDto,
  CompanyResponseDto,
} from "./dto/company-response.dto";
import {
  CompanyMemberEnvelopeDto,
  CompanyMembersListEnvelopeDto,
} from "./dto/company-member-response.dto";

/**
 * Companies + member-management endpoints.
 *
 * The controller is split between routes that resolve to the caller's
 * active company (`/companies/me/...` — covered by the global
 * `ActiveCompanyGuard`) and `POST /companies` which creates a new
 * company and is reachable before the caller has any active company
 * (annotated `@SkipActiveCompany`).
 *
 * `ActiveCompanyGuard` is registered globally in `app.module.ts`, so
 * `/me/...` routes resolve the active company id automatically. The
 * `@SkipActiveCompany()` decorator on POST / opts out of that resolution.
 */
@ApiTags("companies")
@ApiBearerAuth()
@Controller("companies")
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  // ─── Company CRUD ────────────────────────────────────────────────────

  @Post()
  @Roles("recruiter", "admin")
  @SkipActiveCompany()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create a company. The caller becomes its founding owner.",
  })
  @ApiResponse({ status: 201, type: CompanyEnvelopeDto })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCompanyDto,
    @Req() req: FastifyRequest,
  ): Promise<CompanyEnvelopeDto> {
    const data = await this.companies.create(user, dto, this.requestMeta(req));
    return { data };
  }

  @Get("me")
  @Roles("recruiter")
  @ApiOperation({ summary: "Read the caller's currently active company" })
  @ApiResponse({ status: 200, type: CompanyEnvelopeDto })
  async getMine(
    @ActiveCompany() { companyId }: ActiveCompanyContext,
  ): Promise<CompanyEnvelopeDto> {
    const data = await this.companies.getMine(companyId);
    return { data };
  }

  @Patch("me")
  @Roles("recruiter")
  @RequireCompanyRole("owner", "admin")
  @ApiOperation({ summary: "Update the active company (owner/admin only)" })
  @ApiResponse({ status: 200, type: CompanyEnvelopeDto })
  async updateMine(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() { companyId }: ActiveCompanyContext,
    @Body() dto: UpdateCompanyDto,
    @Req() req: FastifyRequest,
  ): Promise<CompanyEnvelopeDto> {
    const data = await this.companies.updateMine(
      user,
      companyId,
      dto,
      this.requestMeta(req),
    );
    return { data };
  }

  @Delete("me")
  @Roles("recruiter")
  @RequireCompanyRole("owner")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Delete the active company (owner only). Requires confirmName.",
  })
  async deleteMine(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() { companyId }: ActiveCompanyContext,
    @Body() dto: DeleteCompanyDto,
    @Req() req: FastifyRequest,
  ): Promise<{ data: { deleted: true; companyId: string } }> {
    const data = await this.companies.deleteMine(
      user,
      companyId,
      dto,
      this.requestMeta(req),
    );
    return { data };
  }

  // ─── Members ─────────────────────────────────────────────────────────

  @Get("me/members")
  @Roles("recruiter")
  @ApiOperation({ summary: "List active members and pending invites" })
  @ApiResponse({ status: 200, type: CompanyMembersListEnvelopeDto })
  async listMembers(
    @ActiveCompany() { companyId }: ActiveCompanyContext,
  ): Promise<CompanyMembersListEnvelopeDto> {
    const data = await this.companies.listMembers(companyId);
    return { data };
  }

  @Post("me/members")
  @Roles("recruiter")
  @RequireCompanyRole("owner", "admin")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Invite a new member by email" })
  @ApiResponse({ status: 201, type: CompanyMemberEnvelopeDto })
  async inviteMember(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() { companyId }: ActiveCompanyContext,
    @Body() dto: InviteMemberDto,
    @Req() req: FastifyRequest,
  ): Promise<CompanyMemberEnvelopeDto> {
    const data = await this.companies.inviteMember(
      user,
      companyId,
      dto,
      this.requestMeta(req),
    );
    return { data };
  }

  @Patch("me/members/:id")
  @Roles("recruiter")
  @RequireCompanyRole("owner")
  @ApiOperation({ summary: "Change a member's role (owner only)" })
  @ApiResponse({ status: 200, type: CompanyMemberEnvelopeDto })
  async updateMember(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() { companyId }: ActiveCompanyContext,
    @Param("id") memberId: string,
    @Body() dto: UpdateMemberDto,
    @Req() req: FastifyRequest,
  ): Promise<CompanyMemberEnvelopeDto> {
    const data = await this.companies.updateMember(
      user,
      companyId,
      memberId,
      dto,
      this.requestMeta(req),
    );
    return { data };
  }

  @Post("me/members/:id/transfer-ownership")
  @Roles("recruiter")
  @RequireCompanyRole("owner")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Transfer your ownership to another active member (owner only)",
  })
  @ApiResponse({ status: 200, type: CompanyMemberEnvelopeDto })
  async transferOwnership(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() { companyId }: ActiveCompanyContext,
    @Param("id") memberId: string,
    @Body() dto: TransferOwnershipDto,
    @Req() req: FastifyRequest,
  ): Promise<CompanyMemberEnvelopeDto> {
    const data = await this.companies.transferOwnership(
      user,
      companyId,
      memberId,
      dto,
      this.requestMeta(req),
    );
    return { data };
  }

  @Post("me/members/:id/resend-invitation")
  @Roles("recruiter")
  @RequireCompanyRole("owner", "admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Regenerate the invite token and resend the email" })
  @ApiResponse({ status: 200, type: CompanyMemberEnvelopeDto })
  async resendInvitation(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() { companyId }: ActiveCompanyContext,
    @Param("id") memberId: string,
    @Req() req: FastifyRequest,
  ): Promise<CompanyMemberEnvelopeDto> {
    const data = await this.companies.resendInvitation(
      user,
      companyId,
      memberId,
      this.requestMeta(req),
    );
    return { data };
  }

  @Delete("me/members/:id")
  @Roles("recruiter")
  @RequireCompanyRole("owner", "admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Revoke a pending invite (hard-delete) or remove an active member (soft-suspend)",
  })
  async removeMember(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() { companyId }: ActiveCompanyContext,
    @Param("id") memberId: string,
    @Req() req: FastifyRequest,
  ): Promise<{ data: { removed: true; memberId: string } }> {
    const data = await this.companies.removeMember(
      user,
      companyId,
      memberId,
      this.requestMeta(req),
    );
    return { data };
  }

  @Post("me/leave")
  @Roles("recruiter")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Leave the active company. Blocked if you are the last owner — transfer first.",
  })
  async leave(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() { companyId, role }: ActiveCompanyContext,
    @Req() req: FastifyRequest,
  ): Promise<{ data: { left: true; nextActiveCompanyId: string | null } }> {
    const data = await this.companies.leaveCompany(
      user,
      companyId,
      role,
      this.requestMeta(req),
    );
    return { data };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private requestMeta(req: FastifyRequest): {
    ipAddress: string | null;
    userAgent: string | null;
  } {
    return {
      ipAddress: req.ip ?? null,
      userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
    };
  }
}

export type { CompanyResponseDto };
