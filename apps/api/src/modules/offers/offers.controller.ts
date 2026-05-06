import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import type { AuthUser } from "@aurahire/shared";

import {
  ActiveCompany,
  type ActiveCompanyContext,
} from "../../common/decorators/active-company.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";

import { CreateOfferDto } from "./dto/create-offer.dto";
import { DeclineOfferDto } from "./dto/decline-offer.dto";
import {
  OfferEnvelopeDto,
  OfferListEnvelopeDto,
} from "./dto/offer-response.dto";
import { OffersService } from "./offers.service";

@ApiTags("offers")
@ApiBearerAuth()
@Controller()
export class OffersController {
  constructor(private readonly service: OffersService) {}

  @Post("applications/:applicationId/offers")
  @Roles("recruiter")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      "Send an offer for an application (the application's job must belong to the active company)",
  })
  @ApiResponse({ status: 201, type: OfferEnvelopeDto })
  @ApiResponse({ status: 409, description: "OFFER_ALREADY_PENDING" })
  async create(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Param("applicationId") applicationId: string,
    @Body() dto: CreateOfferDto,
    @Req() req: FastifyRequest,
  ): Promise<OfferEnvelopeDto> {
    const data = await this.service.create(
      user,
      activeCompany.companyId,
      applicationId,
      dto,
      this.requestMeta(req),
    );
    return { data };
  }

  @Get("offers/mine")
  @Roles("candidate")
  @ApiOperation({ summary: "List candidate's own offers" })
  @ApiResponse({ status: 200, type: OfferListEnvelopeDto })
  async listMine(@CurrentUser() user: AuthUser): Promise<OfferListEnvelopeDto> {
    const data = await this.service.listMine(user);
    return { data };
  }

  @Get("applications/:applicationId/offers")
  @Roles("candidate", "recruiter", "admin")
  @ApiOperation({ summary: "List offers for an application (auth-scoped)" })
  @ApiResponse({ status: 200, type: OfferListEnvelopeDto })
  async listForApplication(
    @CurrentUser() user: AuthUser,
    @Req() req: FastifyRequest,
    @Param("applicationId") applicationId: string,
  ): Promise<OfferListEnvelopeDto> {
    const reqWithCtx = req as FastifyRequest & { activeCompanyId?: string };
    const companyId = reqWithCtx.activeCompanyId ?? null;
    const data = await this.service.listForApplication(user, companyId, applicationId);
    return { data };
  }

  @Post("offers/:id/accept")
  @Roles("candidate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Candidate accepts a pending offer (auto-advances application → hired)" })
  @ApiResponse({ status: 200, type: OfferEnvelopeDto })
  async accept(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ): Promise<OfferEnvelopeDto> {
    const data = await this.service.accept(user, id, this.requestMeta(req));
    return { data };
  }

  @Post("offers/:id/decline")
  @Roles("candidate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Candidate declines a pending offer (optional reason)" })
  @ApiResponse({ status: 200, type: OfferEnvelopeDto })
  async decline(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: DeclineOfferDto,
    @Req() req: FastifyRequest,
  ): Promise<OfferEnvelopeDto> {
    const data = await this.service.decline(user, id, dto, this.requestMeta(req));
    return { data };
  }

  @Post("offers/:id/withdraw")
  @Roles("recruiter")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Recruiter withdraws a pending offer" })
  @ApiResponse({ status: 200, type: OfferEnvelopeDto })
  async withdraw(
    @CurrentUser() user: AuthUser,
    @ActiveCompany() activeCompany: ActiveCompanyContext,
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ): Promise<OfferEnvelopeDto> {
    const data = await this.service.withdraw(
      user,
      activeCompany.companyId,
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
