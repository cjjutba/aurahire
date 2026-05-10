import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { FastifyRequest } from "fastify";
import type { AuthUser } from "@aurahire/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";

import {
  ResumeResponseEnvelopeDto,
  ResumeListResponseDto,
  SignedUrlResponseDto,
} from "./dto/resume-response.dto";
import { ResumesService } from "./resumes.service";

interface MultipartFile {
  filename: string;
  mimetype: string;
  toBuffer: () => Promise<Buffer>;
}

type FastifyMultipartRequest = FastifyRequest & {
  file: () => Promise<MultipartFile | undefined>;
};

@ApiTags("resumes")
@ApiBearerAuth()
@Controller("resumes")
export class ResumesController {
  constructor(private readonly service: ResumesService) {}

  @Post("upload")
  @Roles("candidate")
  @Throttle({ resumeUpload: { limit: 5, ttl: 60 * 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Upload a resume PDF/DOCX and parse it via AI" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
      },
    },
  })
  @ApiResponse({ status: 201, type: ResumeResponseEnvelopeDto })
  @ApiResponse({
    status: 400,
    description: "Unsupported file type or too large",
  })
  async upload(
    @CurrentUser() user: AuthUser,
    @Req() req: FastifyRequest,
  ): Promise<ResumeResponseEnvelopeDto> {
    const fileMP = await (req as FastifyMultipartRequest).file();

    if (!fileMP) {
      throw new BadRequestException({
        code: "NO_FILE",
        message: "No file uploaded",
      });
    }

    const buffer = await fileMP.toBuffer();
    const data = await this.service.upload(
      user,
      {
        filename: fileMP.filename,
        mimeType: fileMP.mimetype,
        buffer,
        sizeBytes: buffer.length,
      },
      this.requestMeta(req),
    );

    return { data };
  }

  @Get("mine")
  @Roles("candidate")
  @ApiOperation({ summary: "List my resumes" })
  @ApiResponse({ status: 200, type: ResumeListResponseDto })
  async listMine(
    @CurrentUser() user: AuthUser,
  ): Promise<ResumeListResponseDto> {
    const data = await this.service.listMine(user);
    return { data };
  }

  @Get(":id")
  @Roles("candidate", "admin")
  @ApiOperation({ summary: "Get a resume by id (own or admin)" })
  @ApiResponse({ status: 200, type: ResumeResponseEnvelopeDto })
  async getById(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ): Promise<ResumeResponseEnvelopeDto> {
    const data = await this.service.getById(user, id);
    return { data };
  }

  @Post(":id/set-default")
  @Roles("candidate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Set this resume as default for applications" })
  @ApiResponse({ status: 200, type: ResumeResponseEnvelopeDto })
  async setDefault(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ): Promise<ResumeResponseEnvelopeDto> {
    const data = await this.service.setDefault(user, id, this.requestMeta(req));
    return { data };
  }

  @Post(":id/reparse")
  @Roles("candidate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Re-run AI parsing against this resume's stored rawText",
  })
  @ApiResponse({ status: 200, type: ResumeResponseEnvelopeDto })
  async reparse(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ): Promise<ResumeResponseEnvelopeDto> {
    const data = await this.service.reparse(user, id, this.requestMeta(req));
    return { data };
  }

  @Delete(":id")
  @Roles("candidate")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a resume" })
  @ApiResponse({ status: 204 })
  async delete(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ): Promise<void> {
    await this.service.delete(user, id, this.requestMeta(req));
  }

  @Get(":id/download")
  @Roles("candidate", "admin")
  @ApiOperation({
    summary: "Get a 1-hour signed URL to download the resume PDF",
  })
  @ApiResponse({ status: 200, type: SignedUrlResponseDto })
  async download(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ): Promise<SignedUrlResponseDto> {
    const data = await this.service.getSignedDownloadUrl(user, id);
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
