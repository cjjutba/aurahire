import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import type { AuthUser } from "@aurahire/shared";
import type { Resume } from "@aurahire/db";

import { AuditService } from "../../audit";
import { StorageService } from "../../storage/storage.service";
import { DocxToPdfService } from "../../storage/docx-to-pdf.service";
import { ParseResumeService } from "../../ai/parse-resume.service";
import { MatchPreviewQueueService } from "../../queue/match-preview-queue.service";
import { ResumesRepository } from "./resumes.repository";
import type { ResumeResponseDto } from "./dto/resume-response.dto";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ALLOWED_MIME_TYPES = ["application/pdf", DOCX_MIME] as const;
type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const RESUMES_BUCKET = "resumes";

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class ResumesService {
  private readonly logger = new Logger(ResumesService.name);

  constructor(
    private readonly repo: ResumesRepository,
    private readonly storage: StorageService,
    private readonly parser: ParseResumeService,
    private readonly audit: AuditService,
    private readonly docxToPdf: DocxToPdfService,
    private readonly matchPreviewQueue: MatchPreviewQueueService,
  ) {}

  // -----------------------------------------------------------------
  // UPLOAD + PARSE
  // -----------------------------------------------------------------

  async upload(
    user: AuthUser,
    file: { filename: string; mimeType: string; buffer: Buffer; sizeBytes: number },
    requestMeta: RequestMeta = {},
  ): Promise<ResumeResponseDto> {
    if (user.role !== "candidate") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Candidate role required",
      });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimeType as AllowedMime)) {
      throw new BadRequestException({
        code: "UNSUPPORTED_FILE_TYPE",
        message: `Only PDF and DOCX files are accepted (got ${file.mimeType})`,
      });
    }

    if (file.sizeBytes > MAX_SIZE_BYTES) {
      throw new BadRequestException({
        code: "FILE_TOO_LARGE",
        message: `File exceeds 10MB limit`,
      });
    }

    const ext =
      extname(file.filename) || (file.mimeType === "application/pdf" ? ".pdf" : ".docx");
    const storagePath = `${user.id}/${randomUUID()}${ext}`;

    const hadResumes = await this.repo.hasResumes(user.id);
    const isFirstResume = !hadResumes;

    await this.storage.upload({
      bucket: RESUMES_BUCKET,
      path: storagePath,
      buffer: file.buffer,
      contentType: file.mimeType,
    });

    let canonicalPdfPath: string | null = null;
    if (file.mimeType === DOCX_MIME) {
      try {
        const pdfBuffer = await this.docxToPdf.convert(file.buffer);
        canonicalPdfPath = `${user.id}/${randomUUID()}.pdf`;
        await this.storage.upload({
          bucket: RESUMES_BUCKET,
          path: canonicalPdfPath,
          buffer: pdfBuffer,
          contentType: "application/pdf",
        });
      } catch (err) {
        this.logger.warn(
          `DOCX to PDF conversion failed: ${(err as Error).message}`,
        );
        canonicalPdfPath = null;
        // Continue without canonical PDF — frontend will fall back to LinearizedResumeView.
      }
    }

    const resume = await this.repo.insert({
      candidateId: user.id,
      filename: file.filename,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      storagePath,
      canonicalPdfPath,
      parseStatus: "parsing",
      isDefault: isFirstResume,
    });

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "resume.uploaded",
      entityType: "resume",
      entityId: resume.id,
      details: {
        filename: file.filename,
        sizeBytes: file.sizeBytes,
        isDefault: isFirstResume,
      },
      ...requestMeta,
    });

    try {
      const parseResult = await this.parser.parse({
        storagePath,
        mimeType: file.mimeType,
        requestId: `upload:${resume.id}`,
      });

      const updated = await this.repo.update(resume.id, {
        rawText: parseResult.rawText,
        parsedData: parseResult.parsed as unknown as Record<string, unknown>,
        parseStatus: "parsed",
      });

      await this.audit.log({
        actorId: user.id,
        actorType: "ai",
        action: "resume.parsed",
        entityType: "resume",
        entityId: resume.id,
        details: {
          model: parseResult.model,
          promptVersion: parseResult.promptVersion,
          latencyMs: parseResult.latencyMs,
          parseConfidence: parseResult.parsed.parse_confidence,
        },
        ...requestMeta,
      });

      if (isFirstResume) {
        try {
          await this.repo.setDefault(user.id, updated.id);
        } catch (err) {
          this.logger.warn(`Set default failed: ${(err as Error).message}`);
        }
      }

      // Fire-and-forget: queue the top-N match-preview precompute pass so
      // candidates see "Recommended for you" populated by the time they
      // visit the dashboard. Failure to enqueue is non-fatal — the parse
      // itself succeeded.
      void this.matchPreviewQueue.enqueuePrecompute({
        candidateId: user.id,
        resumeId: updated.id,
      });

      const final = (await this.repo.findById(resume.id))!;
      return this.toResponse(final);
    } catch (err) {
      const message = (err as Error).message ?? "Parse failed";
      this.logger.error(`Resume parse failed for ${resume.id}: ${message}`);

      await this.repo.update(resume.id, {
        parseStatus: "failed",
        parseError: message.slice(0, 500),
      });

      await this.audit.log({
        actorId: user.id,
        actorType: "ai",
        action: "resume.parse_failed",
        entityType: "resume",
        entityId: resume.id,
        details: { error: message.slice(0, 500) },
        ...requestMeta,
      });

      const failedResume = (await this.repo.findById(resume.id))!;
      return this.toResponse(failedResume);
    }
  }

  // -----------------------------------------------------------------
  // REPARSE
  // -----------------------------------------------------------------

  async reparse(
    user: AuthUser,
    id: string,
    requestMeta: RequestMeta = {},
  ): Promise<ResumeResponseDto> {
    const resume = await this.repo.findById(id);
    if (!resume || resume.candidateId !== user.id) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Resume not found" });
    }
    if (user.role !== "candidate") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Candidate role required" });
    }

    await this.repo.update(id, { parseStatus: "parsing", parseError: null });

    try {
      const parseResult = await this.parser.parse({
        storagePath: resume.storagePath,
        mimeType: resume.mimeType,
        rawText: resume.rawText ?? undefined,
        requestId: `reparse:${id}`,
      });

      await this.repo.update(id, {
        rawText: parseResult.rawText,
        parsedData: parseResult.parsed as unknown as Record<string, unknown>,
        parseStatus: "parsed",
      });

      await this.audit.log({
        actorId: user.id,
        actorType: "ai",
        action: "resume.reparsed",
        entityType: "resume",
        entityId: id,
        details: {
          model: parseResult.model,
          promptVersion: parseResult.promptVersion,
          latencyMs: parseResult.latencyMs,
          parseConfidence: parseResult.parsed.parse_confidence,
          sourceFieldCoverage: parseResult.sourceFieldCoverage,
          sourceHallucinationCount: parseResult.sourceHallucinations.length,
        },
        ...requestMeta,
      });

      // Reparse means the parsed_data changed → existing previews against
      // this resume are now stale. The precompute worker UPSERTs (so
      // duplicates won't accumulate), but we still want the recommended
      // feed refreshed with the new parsed signal. Idempotent jobId on
      // the queue dedupes burst clicks.
      void this.matchPreviewQueue.enqueuePrecompute({
        candidateId: user.id,
        resumeId: id,
      });

      const final = (await this.repo.findById(id))!;
      return this.toResponse(final);
    } catch (err) {
      const message = (err as Error).message ?? "Reparse failed";
      this.logger.error(`Resume reparse failed for ${id}: ${message}`);

      await this.repo.update(id, {
        parseStatus: "failed",
        parseError: message.slice(0, 500),
      });

      await this.audit.log({
        actorId: user.id,
        actorType: "ai",
        action: "resume.reparse_failed",
        entityType: "resume",
        entityId: id,
        details: { error: message.slice(0, 500) },
        ...requestMeta,
      });

      const failed = (await this.repo.findById(id))!;
      return this.toResponse(failed);
    }
  }

  // -----------------------------------------------------------------
  // LIST / GET / SET-DEFAULT / DELETE / DOWNLOAD
  // -----------------------------------------------------------------

  async listMine(user: AuthUser): Promise<ResumeResponseDto[]> {
    if (user.role !== "candidate") {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Candidate role required",
      });
    }
    const rows = await this.repo.findByCandidateId(user.id);
    return rows.map((r) => this.toResponse(r));
  }

  async getById(user: AuthUser, id: string): Promise<ResumeResponseDto> {
    const resume = await this.repo.findById(id);
    if (!resume) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Resume not found" });
    }
    if (user.role === "candidate" && resume.candidateId !== user.id) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Resume not found" });
    }
    if (user.role === "recruiter") {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Resume not found" });
    }
    return this.toResponse(resume);
  }

  async setDefault(
    user: AuthUser,
    id: string,
    requestMeta: RequestMeta = {},
  ): Promise<ResumeResponseDto> {
    const resume = await this.repo.findById(id);
    if (!resume || resume.candidateId !== user.id) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Resume not found" });
    }

    await this.repo.setDefault(user.id, id);

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "resume.set_default",
      entityType: "resume",
      entityId: id,
      ...requestMeta,
    });

    const updated = (await this.repo.findById(id))!;
    return this.toResponse(updated);
  }

  async delete(
    user: AuthUser,
    id: string,
    requestMeta: RequestMeta = {},
  ): Promise<void> {
    const resume = await this.repo.findById(id);
    if (!resume || resume.candidateId !== user.id) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Resume not found" });
    }

    await this.storage.delete({ bucket: RESUMES_BUCKET, path: resume.storagePath });
    await this.repo.delete(id);

    await this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "resume.deleted",
      entityType: "resume",
      entityId: id,
      details: { filename: resume.filename },
      ...requestMeta,
    });
  }

  async getSignedDownloadUrl(
    user: AuthUser,
    id: string,
  ): Promise<{ signedUrl: string; signedPdfUrl: string; expiresAt: string }> {
    const resume = await this.repo.findById(id);
    if (!resume) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Resume not found" });
    }

    if (user.role === "candidate" && resume.candidateId !== user.id) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Resume not found" });
    }
    if (user.role === "recruiter") {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Resume not found" });
    }

    const expiresIn = 60 * 60;
    const [signedUrl, signedPdfUrl] = await Promise.all([
      this.storage.signedUrl({
        bucket: RESUMES_BUCKET,
        path: resume.storagePath,
        expiresIn,
      }),
      this.storage.signedUrl({
        bucket: RESUMES_BUCKET,
        path: resume.canonicalPdfPath ?? resume.storagePath,
        expiresIn,
      }),
    ]);

    return {
      signedUrl,
      signedPdfUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  // -----------------------------------------------------------------
  // PRIVATE
  // -----------------------------------------------------------------

  private toResponse(row: Resume): ResumeResponseDto {
    return {
      id: row.id,
      candidateId: row.candidateId,
      filename: row.filename,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      storagePath: row.storagePath,
      canonicalPdfPath: row.canonicalPdfPath,
      rawText: row.rawText,
      parsedData: row.parsedData,
      parseStatus: row.parseStatus,
      parseError: row.parseError,
      isDefault: row.isDefault,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
