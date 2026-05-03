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
  Query,
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

import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";

import { ListAdminUsersQueryDto } from "../dto/list-users-query.dto";
import { SuspendUserDto } from "../dto/suspend-user.dto";
import { ChangeUserRoleDto } from "../dto/change-role.dto";
import {
  AdminUserEnvelopeDto,
  AdminUserListEnvelopeDto,
  ForcePasswordResetResponseDto,
} from "../dto/admin-user-response.dto";
import { AdminUsersService } from "../services/admin-users.service";

@ApiTags("admin-users")
@ApiBearerAuth()
@Controller("admin/users")
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get()
  @Roles("admin")
  @ApiOperation({ summary: "List/filter all users" })
  @ApiResponse({ status: 200, type: AdminUserListEnvelopeDto })
  async list(
    @Query() query: ListAdminUsersQueryDto,
  ): Promise<AdminUserListEnvelopeDto> {
    return this.service.list(query);
  }

  @Get(":id")
  @Roles("admin")
  @ApiOperation({ summary: "Get user detail (incl. audit count)" })
  @ApiResponse({ status: 200, type: AdminUserEnvelopeDto })
  async getById(@Param("id") id: string): Promise<AdminUserEnvelopeDto> {
    const data = await this.service.getById(id);
    return { data };
  }

  @Post(":id/suspend")
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Suspend a user (status='suspended'); reason required ≥10 chars",
  })
  @ApiResponse({ status: 200, type: AdminUserEnvelopeDto })
  @ApiResponse({ status: 403, description: "Cannot target self" })
  async suspend(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: SuspendUserDto,
    @Req() req: FastifyRequest,
  ): Promise<AdminUserEnvelopeDto> {
    const updated = await this.service.suspend(
      actor,
      id,
      dto,
      this.requestMeta(req),
    );
    return { data: { ...updated, auditEntryCount: 0 } };
  }

  @Post(":id/reactivate")
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reactivate a suspended user" })
  @ApiResponse({ status: 200, type: AdminUserEnvelopeDto })
  async reactivate(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ): Promise<AdminUserEnvelopeDto> {
    const updated = await this.service.reactivate(
      actor,
      id,
      this.requestMeta(req),
    );
    return { data: { ...updated, auditEntryCount: 0 } };
  }

  @Patch(":id/role")
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Change a user's role" })
  @ApiResponse({ status: 200, type: AdminUserEnvelopeDto })
  @ApiResponse({ status: 403, description: "Cannot demote self from admin" })
  async changeRole(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: ChangeUserRoleDto,
    @Req() req: FastifyRequest,
  ): Promise<AdminUserEnvelopeDto> {
    const updated = await this.service.changeRole(
      actor,
      id,
      dto,
      this.requestMeta(req),
    );
    return { data: { ...updated, auditEntryCount: 0 } };
  }

  @Delete(":id")
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Hard-delete a user (soft-delete profile + delete auth.users row)",
  })
  @ApiResponse({ status: 200, type: AdminUserEnvelopeDto })
  @ApiResponse({ status: 403, description: "Cannot target self" })
  async delete(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ): Promise<AdminUserEnvelopeDto> {
    const updated = await this.service.delete(
      actor,
      id,
      this.requestMeta(req),
    );
    return { data: { ...updated, auditEntryCount: 0 } };
  }

  @Post(":id/force-password-reset")
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Issue a password-reset token (and email it) on behalf of a user",
  })
  @ApiResponse({ status: 200, type: ForcePasswordResetResponseDto })
  async forcePasswordReset(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ): Promise<ForcePasswordResetResponseDto> {
    const data = await this.service.forcePasswordReset(
      actor,
      id,
      this.requestMeta(req),
    );
    return { data };
  }

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
