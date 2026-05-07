import type { AuthUser } from "@aurahire/shared";
import type { Resume } from "@aurahire/db";

import { ResumesService } from "./resumes.service";
import type { ResumesRepository } from "./resumes.repository";
import type { StorageService } from "../../storage/storage.service";
import type { ParseResumeService } from "../../ai/parse-resume.service";
import type { AuditService } from "../../audit";
import type { DocxToPdfService } from "../../storage/docx-to-pdf.service";
import type { MatchPreviewQueueService } from "../../queue/match-preview-queue.service";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("ResumesService.upload", () => {
  const candidateUser: AuthUser = {
    id: "11111111-1111-1111-1111-111111111111",
    email: "candidate@example.com",
    role: "candidate",
    status: "active",
    fullName: "Test Candidate",
    profileCompleted: true,
  };

  function buildSvc() {
    const insertedRowsByCall: Array<Record<string, unknown>> = [];
    const repo = {
      hasResumes: jest.fn().mockResolvedValue(true), // not first resume → skip setDefault path
      insert: jest.fn(async (data: Record<string, unknown>) => {
        insertedRowsByCall.push(data);
        const row: Resume = {
          id: "22222222-2222-2222-2222-222222222222",
          candidateId: candidateUser.id,
          filename: data.filename as string,
          mimeType: data.mimeType as string,
          sizeBytes: data.sizeBytes as number,
          storagePath: data.storagePath as string,
          canonicalPdfPath: (data.canonicalPdfPath as string | null) ?? null,
          rawText: null,
          parsedData: null,
          parseStatus: (data.parseStatus as Resume["parseStatus"]) ?? "parsing",
          parseError: null,
          isDefault: (data.isDefault as boolean) ?? false,
          createdAt: new Date("2026-05-05T00:00:00Z"),
          updatedAt: new Date("2026-05-05T00:00:00Z"),
        };
        return row;
      }),
      update: jest.fn(async (id: string, patch: Record<string, unknown>) => {
        const last = insertedRowsByCall[insertedRowsByCall.length - 1] ?? {};
        const row: Resume = {
          id,
          candidateId: candidateUser.id,
          filename: (last.filename as string) ?? "resume.pdf",
          mimeType: (last.mimeType as string) ?? "application/pdf",
          sizeBytes: (last.sizeBytes as number) ?? 1,
          storagePath: (last.storagePath as string) ?? "path",
          canonicalPdfPath:
            (patch.canonicalPdfPath as string | null | undefined) ??
            ((last.canonicalPdfPath as string | null) ?? null),
          rawText: (patch.rawText as string | null | undefined) ?? null,
          parsedData:
            (patch.parsedData as Record<string, unknown> | null | undefined) ??
            null,
          parseStatus:
            (patch.parseStatus as Resume["parseStatus"] | undefined) ??
            "parsed",
          parseError: (patch.parseError as string | null | undefined) ?? null,
          isDefault: (last.isDefault as boolean) ?? false,
          createdAt: new Date("2026-05-05T00:00:00Z"),
          updatedAt: new Date("2026-05-05T00:00:00Z"),
        };
        return row;
      }),
      findById: jest.fn(async (id: string) => {
        const last = insertedRowsByCall[insertedRowsByCall.length - 1] ?? {};
        const row: Resume = {
          id,
          candidateId: candidateUser.id,
          filename: (last.filename as string) ?? "resume.pdf",
          mimeType: (last.mimeType as string) ?? "application/pdf",
          sizeBytes: (last.sizeBytes as number) ?? 1,
          storagePath: (last.storagePath as string) ?? "path",
          canonicalPdfPath: (last.canonicalPdfPath as string | null) ?? null,
          rawText: "parsed text",
          parsedData: { parse_confidence: 0.9 } as Record<string, unknown>,
          parseStatus: "parsed",
          parseError: null,
          isDefault: false,
          createdAt: new Date("2026-05-05T00:00:00Z"),
          updatedAt: new Date("2026-05-05T00:00:00Z"),
        };
        return row;
      }),
      setDefault: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ResumesRepository>;

    const storage = {
      upload: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      signedUrl: jest.fn().mockResolvedValue("https://signed.example/url"),
    } as unknown as jest.Mocked<StorageService>;

    const parser = {
      parse: jest.fn().mockResolvedValue({
        rawText: "raw text",
        parsed: { parse_confidence: 0.9 },
        model: "gpt-4o-mini",
        promptVersion: "v1",
        latencyMs: 123,
      }),
    } as unknown as jest.Mocked<ParseResumeService>;

    const audit = {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;

    const docxToPdf = {
      convert: jest.fn().mockResolvedValue(Buffer.from("%PDF-1.4 fake")),
    } as unknown as jest.Mocked<DocxToPdfService>;

    const matchPreviewQueue = {
      enqueuePrecompute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MatchPreviewQueueService>;

    const svc = new ResumesService(repo, storage, parser, audit, docxToPdf, matchPreviewQueue);
    return { svc, repo, storage, parser, audit, docxToPdf, matchPreviewQueue };
  }

  it("converts DOCX uploads to canonical PDF and stores both files", async () => {
    const { svc, repo, storage, docxToPdf } = buildSvc();

    const result = await svc.upload(candidateUser, {
      filename: "resume.docx",
      mimeType: DOCX_MIME,
      buffer: Buffer.from("docx-bytes"),
      sizeBytes: 10,
    });

    expect(docxToPdf.convert).toHaveBeenCalledTimes(1);
    expect(docxToPdf.convert).toHaveBeenCalledWith(expect.any(Buffer));

    // storage.upload called twice: original DOCX + canonical PDF
    expect(storage.upload).toHaveBeenCalledTimes(2);

    const firstCall = (storage.upload as jest.Mock).mock.calls[0][0];
    expect(firstCall.contentType).toBe(DOCX_MIME);

    const secondCall = (storage.upload as jest.Mock).mock.calls[1][0];
    expect(secondCall.contentType).toBe("application/pdf");
    expect(secondCall.path).toMatch(/\.pdf$/);
    expect(secondCall.path.startsWith(`${candidateUser.id}/`)).toBe(true);

    // repo.insert received non-null canonicalPdfPath
    const insertArgs = (repo.insert as jest.Mock).mock.calls[0][0];
    expect(insertArgs.canonicalPdfPath).toBe(secondCall.path);
    expect(insertArgs.mimeType).toBe(DOCX_MIME);

    expect(result.canonicalPdfPath).toBe(secondCall.path);
  });

  it("skips DOCX conversion for PDF uploads", async () => {
    const { svc, repo, storage, docxToPdf } = buildSvc();

    const result = await svc.upload(candidateUser, {
      filename: "resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 raw"),
      sizeBytes: 12,
    });

    expect(docxToPdf.convert).not.toHaveBeenCalled();
    expect(storage.upload).toHaveBeenCalledTimes(1);

    const insertArgs = (repo.insert as jest.Mock).mock.calls[0][0];
    expect(insertArgs.canonicalPdfPath).toBeNull();
    expect(insertArgs.mimeType).toBe("application/pdf");

    expect(result.canonicalPdfPath).toBeNull();
  });
});

describe("ResumesService.reparse", () => {
  const candidateUser: AuthUser = {
    id: "11111111-1111-1111-1111-111111111111",
    email: "candidate@example.com",
    role: "candidate",
    status: "active",
    fullName: "Test Candidate",
    profileCompleted: true,
  };

  function buildResume(overrides: Partial<Resume> = {}): Resume {
    return {
      id: "22222222-2222-2222-2222-222222222222",
      candidateId: candidateUser.id,
      filename: "resume.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      storagePath: `${candidateUser.id}/source.pdf`,
      canonicalPdfPath: null,
      rawText: "cached raw text from prior parse",
      parsedData: null,
      parseStatus: "parsing",
      parseError: null,
      isDefault: false,
      createdAt: new Date("2026-05-05T00:00:00Z"),
      updatedAt: new Date("2026-05-05T00:00:00Z"),
      ...overrides,
    };
  }

  function buildSvc(opts: {
    initialResume: Resume;
    parserImpl?: jest.Mock;
  }) {
    let currentRow: Resume = opts.initialResume;

    const repo = {
      findById: jest.fn(async (_id: string) => currentRow),
      update: jest.fn(async (id: string, patch: Record<string, unknown>) => {
        currentRow = {
          ...currentRow,
          id,
          rawText:
            (patch.rawText as string | null | undefined) !== undefined
              ? (patch.rawText as string | null)
              : currentRow.rawText,
          parsedData:
            (patch.parsedData as Record<string, unknown> | null | undefined) !==
            undefined
              ? (patch.parsedData as Record<string, unknown> | null)
              : currentRow.parsedData,
          parseStatus:
            (patch.parseStatus as Resume["parseStatus"] | undefined) ??
            currentRow.parseStatus,
          parseError:
            (patch.parseError as string | null | undefined) !== undefined
              ? (patch.parseError as string | null)
              : currentRow.parseError,
        };
        return currentRow;
      }),
    } as unknown as jest.Mocked<ResumesRepository>;

    const storage = {} as unknown as jest.Mocked<StorageService>;

    const parser = {
      parse:
        opts.parserImpl ??
        jest.fn().mockResolvedValue({
          rawText: "cached raw text from prior parse",
          parsed: { parse_confidence: 0.92 },
          model: "gpt-4o-mini",
          promptVersion: "v2",
          latencyMs: 234,
          sourceFieldCoverage: 1,
          sourceHallucinations: [],
        }),
    } as unknown as jest.Mocked<ParseResumeService>;

    const audit = {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;

    const docxToPdf = {} as unknown as jest.Mocked<DocxToPdfService>;

    const matchPreviewQueue = {
      enqueuePrecompute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MatchPreviewQueueService>;

    const svc = new ResumesService(repo, storage, parser, audit, docxToPdf, matchPreviewQueue);
    return { svc, repo, parser, audit };
  }

  it("re-runs parse, updates row, writes audit log", async () => {
    const initial = buildResume();
    const { svc, repo, parser, audit } = buildSvc({ initialResume: initial });

    const result = await svc.reparse(candidateUser, initial.id);

    expect(parser.parse).toHaveBeenCalledTimes(1);
    const parseArgs = (parser.parse as jest.Mock).mock.calls[0][0];
    expect(parseArgs.rawText).toBe("cached raw text from prior parse");
    expect(parseArgs.storagePath).toBe(initial.storagePath);
    expect(parseArgs.mimeType).toBe(initial.mimeType);
    expect(parseArgs.requestId).toBe(`reparse:${initial.id}`);

    // First update: parseStatus = "parsing"
    expect(repo.update).toHaveBeenCalledTimes(2);
    const firstPatch = (repo.update as jest.Mock).mock.calls[0][1];
    expect(firstPatch.parseStatus).toBe("parsing");
    expect(firstPatch.parseError).toBeNull();

    // Second update: parsed data
    const secondPatch = (repo.update as jest.Mock).mock.calls[1][1];
    expect(secondPatch.parseStatus).toBe("parsed");
    expect(secondPatch.rawText).toBe("cached raw text from prior parse");
    expect(secondPatch.parsedData).toEqual({ parse_confidence: 0.92 });

    // Audit log: resume.reparsed
    expect(audit.log).toHaveBeenCalledTimes(1);
    const auditArgs = (audit.log as jest.Mock).mock.calls[0][0];
    expect(auditArgs.action).toBe("resume.reparsed");
    expect(auditArgs.actorType).toBe("ai");
    expect(auditArgs.entityType).toBe("resume");
    expect(auditArgs.entityId).toBe(initial.id);
    expect(auditArgs.details.model).toBe("gpt-4o-mini");
    expect(auditArgs.details.promptVersion).toBe("v2");
    expect(auditArgs.details.parseConfidence).toBe(0.92);
    expect(auditArgs.details.sourceFieldCoverage).toBe(1);
    expect(auditArgs.details.sourceHallucinationCount).toBe(0);

    expect(result.parseStatus).toBe("parsed");
  });

  it("marks resume failed and logs reparse_failed when parser throws", async () => {
    const initial = buildResume();
    const parserImpl = jest.fn().mockRejectedValue(new Error("OpenAI rate limit"));
    const { svc, repo, audit } = buildSvc({ initialResume: initial, parserImpl });

    const result = await svc.reparse(candidateUser, initial.id);

    // Two updates: first "parsing", then "failed"
    expect(repo.update).toHaveBeenCalledTimes(2);
    const firstPatch = (repo.update as jest.Mock).mock.calls[0][1];
    expect(firstPatch.parseStatus).toBe("parsing");

    const failedPatch = (repo.update as jest.Mock).mock.calls[1][1];
    expect(failedPatch.parseStatus).toBe("failed");
    expect(failedPatch.parseError).toBe("OpenAI rate limit");

    // Audit log: resume.reparse_failed
    expect(audit.log).toHaveBeenCalledTimes(1);
    const auditArgs = (audit.log as jest.Mock).mock.calls[0][0];
    expect(auditArgs.action).toBe("resume.reparse_failed");
    expect(auditArgs.details.error).toBe("OpenAI rate limit");

    // Returns the failed resume (no exception)
    expect(result.parseStatus).toBe("failed");
    expect(result.parseError).toBe("OpenAI rate limit");
  });

  it("rejects when resume belongs to a different candidate", async () => {
    const otherCandidatesResume = buildResume({
      candidateId: "99999999-9999-9999-9999-999999999999",
    });
    const { svc } = buildSvc({ initialResume: otherCandidatesResume });

    await expect(
      svc.reparse(candidateUser, otherCandidatesResume.id),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "NOT_FOUND" }),
    });
  });
});

describe("ResumesService.getSignedDownloadUrl", () => {
  const candidateUser: AuthUser = {
    id: "11111111-1111-1111-1111-111111111111",
    email: "candidate@example.com",
    role: "candidate",
    status: "active",
    fullName: "Test Candidate",
    profileCompleted: true,
  };

  function buildSvc(resumeRow: Resume) {
    const repo = {
      findById: jest.fn().mockResolvedValue(resumeRow),
    } as unknown as jest.Mocked<ResumesRepository>;

    const storage = {
      signedUrl: jest.fn(async ({ path }: { path: string }) => `signed:${path}`),
    } as unknown as jest.Mocked<StorageService>;

    const parser = {} as unknown as jest.Mocked<ParseResumeService>;
    const audit = {} as unknown as jest.Mocked<AuditService>;
    const docxToPdf = {} as unknown as jest.Mocked<DocxToPdfService>;
    const matchPreviewQueue =
      {} as unknown as jest.Mocked<MatchPreviewQueueService>;

    const svc = new ResumesService(repo, storage, parser, audit, docxToPdf, matchPreviewQueue);
    return { svc, repo, storage };
  }

  function buildResume(overrides: Partial<Resume> = {}): Resume {
    return {
      id: "22222222-2222-2222-2222-222222222222",
      candidateId: candidateUser.id,
      filename: "resume.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 100,
      storagePath: `${candidateUser.id}/source.docx`,
      canonicalPdfPath: `${candidateUser.id}/canonical.pdf`,
      rawText: null,
      parsedData: null,
      parseStatus: "parsed",
      parseError: null,
      isDefault: true,
      createdAt: new Date("2026-05-05T00:00:00Z"),
      updatedAt: new Date("2026-05-05T00:00:00Z"),
      ...overrides,
    };
  }

  it("returns signedPdfUrl pointing to canonical PDF for DOCX uploads", async () => {
    const resume = buildResume({
      storagePath: `${candidateUser.id}/source.docx`,
      canonicalPdfPath: `${candidateUser.id}/canonical.pdf`,
    });
    const { svc, storage } = buildSvc(resume);

    const result = await svc.getSignedDownloadUrl(candidateUser, resume.id);

    expect(storage.signedUrl).toHaveBeenCalledTimes(2);
    expect(result.signedUrl).toBe(`signed:${resume.storagePath}`);
    expect(result.signedPdfUrl).toBe(`signed:${resume.canonicalPdfPath}`);
    expect(result.signedUrl).not.toBe(result.signedPdfUrl);
    expect(typeof result.expiresAt).toBe("string");
  });

  it("returns signedPdfUrl pointing to storagePath for PDF uploads (canonicalPdfPath null)", async () => {
    const resume = buildResume({
      filename: "resume.pdf",
      mimeType: "application/pdf",
      storagePath: `${candidateUser.id}/source.pdf`,
      canonicalPdfPath: null,
    });
    const { svc, storage } = buildSvc(resume);

    const result = await svc.getSignedDownloadUrl(candidateUser, resume.id);

    expect(storage.signedUrl).toHaveBeenCalledTimes(2);
    expect(result.signedUrl).toBe(`signed:${resume.storagePath}`);
    expect(result.signedPdfUrl).toBe(`signed:${resume.storagePath}`);
    expect(result.signedPdfUrl).toBe(result.signedUrl);
  });
});
