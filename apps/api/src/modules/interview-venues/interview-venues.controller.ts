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

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";

import {
  InterviewVenueInputDto,
  InterviewVenuePartialDto,
} from "./dto/interview-venue-input.dto";
import {
  InterviewVenueDto,
  InterviewVenueEnvelopeDto,
  InterviewVenueListEnvelopeDto,
} from "./dto/interview-venue-response.dto";
import { InterviewVenuesService } from "./interview-venues.service";

@ApiTags("interview-venues")
@ApiBearerAuth()
@Controller()
export class InterviewVenuesController {
  constructor(private readonly service: InterviewVenuesService) {}

  @Get("companies/:companyId/interview-venues")
  @Roles("recruiter", "admin")
  @ApiOperation({ summary: "List company's interview venue templates" })
  @ApiResponse({ status: 200, type: InterviewVenueListEnvelopeDto })
  async list(
    @CurrentUser() user: AuthUser,
    @Param("companyId") companyId: string,
  ): Promise<InterviewVenueListEnvelopeDto> {
    const data = (await this.service.list(
      user,
      companyId,
    )) as InterviewVenueDto[];
    return { data };
  }

  @Post("companies/:companyId/interview-venues")
  @Roles("recruiter", "admin")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a venue template for a company" })
  @ApiResponse({ status: 201, type: InterviewVenueEnvelopeDto })
  async create(
    @CurrentUser() user: AuthUser,
    @Param("companyId") companyId: string,
    @Body() dto: InterviewVenueInputDto,
    @Req() req: FastifyRequest,
  ): Promise<InterviewVenueEnvelopeDto> {
    const data = (await this.service.create(
      user,
      companyId,
      dto,
      this.requestMeta(req),
    )) as InterviewVenueDto;
    return { data };
  }

  @Patch("interview-venues/:id")
  @Roles("recruiter", "admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update a venue template" })
  @ApiResponse({ status: 200, type: InterviewVenueEnvelopeDto })
  async update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: InterviewVenuePartialDto,
    @Req() req: FastifyRequest,
  ): Promise<InterviewVenueEnvelopeDto> {
    const data = (await this.service.update(
      user,
      id,
      dto,
      this.requestMeta(req),
    )) as InterviewVenueDto;
    return { data };
  }

  @Delete("interview-venues/:id")
  @Roles("recruiter", "admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a venue template" })
  @ApiResponse({ status: 204 })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ): Promise<void> {
    await this.service.remove(user, id, this.requestMeta(req));
  }

  @Post("interview-venues/:id/set-default")
  @Roles("recruiter", "admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Set this venue as the company default (clears other defaults)",
  })
  @ApiResponse({ status: 200, type: InterviewVenueEnvelopeDto })
  async setDefault(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ): Promise<InterviewVenueEnvelopeDto> {
    const data = (await this.service.setDefault(
      user,
      id,
      this.requestMeta(req),
    )) as InterviewVenueDto;
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
