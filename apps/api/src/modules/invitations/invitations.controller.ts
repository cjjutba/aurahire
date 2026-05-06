import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import type { AuthUser } from "@aurahire/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { SkipActiveCompany } from "../../common/decorators/skip-active-company.decorator";

import { InvitationsService } from "./invitations.service";
import {
  InvitationPreviewEnvelopeDto,
} from "./dto/invitation-preview.dto";
import {
  InvitationAcceptEnvelopeDto,
  InvitationDeclineEnvelopeDto,
  InvitationTokenDto,
} from "./dto/invitation-response.dto";

@ApiTags("invitations")
@ApiBearerAuth()
@Controller("invitations")
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  /**
   * Public preview of an invitation. The frontend `/invite/{token}` page hits
   * this server-side to render the "{Inviter} invited you to {Company}"
   * preview before authenticating.
   */
  @Get("preview")
  @Public()
  @ApiOperation({
    summary:
      "Public preview of an invitation by token. No authentication required.",
  })
  @ApiQuery({ name: "token", required: true, type: String })
  @ApiResponse({ status: 200, type: InvitationPreviewEnvelopeDto })
  @ApiResponse({ status: 404, description: "Token unknown or already used" })
  async preview(
    @Query("token") token: string,
  ): Promise<InvitationPreviewEnvelopeDto> {
    const data = await this.invitations.preview(token);
    return { data };
  }

  @Post("accept")
  @SkipActiveCompany()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Accept a pending invitation. Sets profiles.last_active_company_id.",
  })
  @ApiResponse({ status: 200, type: InvitationAcceptEnvelopeDto })
  @ApiResponse({ status: 410, description: "Invitation expired" })
  async accept(
    @CurrentUser() user: AuthUser,
    @Body() dto: InvitationTokenDto,
    @Req() req: FastifyRequest,
  ): Promise<InvitationAcceptEnvelopeDto> {
    const data = await this.invitations.accept(
      user,
      dto.token,
      this.requestMeta(req),
    );
    return { data };
  }

  @Post("decline")
  @SkipActiveCompany()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Decline a pending invitation" })
  @ApiResponse({ status: 200, type: InvitationDeclineEnvelopeDto })
  async decline(
    @CurrentUser() user: AuthUser,
    @Body() dto: InvitationTokenDto,
    @Req() req: FastifyRequest,
  ): Promise<InvitationDeclineEnvelopeDto> {
    const data = await this.invitations.decline(
      user,
      dto.token,
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
