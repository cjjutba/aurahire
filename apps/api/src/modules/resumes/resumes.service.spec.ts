import type { AuthUser } from "@aurahire/shared";
import type { Resume } from "@aurahire/db";

import { ResumesService } from "./resumes.service";
import type { ResumesRepository } from "./resumes.repository";
import type { StorageService } from "../../storage/storage.service";
import type { ParseResumeService } from "../../ai/parse-resume.service";
import type { AuditService } from "../../audit";
import type { DocxToPdfService } from "../../storage/docx-to-pdf.service";
import type { MatchPreviewQueueService } from "../../queue/match-preview-queue.service";
import type { ProfileScoreQueueService } from "../../queue/profile-score-queue.service";
import type { DrizzleClient } from "../../db/db.module";

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
            (last.canonicalPdfPath as string | null) ??
            null,
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
      cancelByResumeId: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<MatchPreviewQueueService>;

    const profileScoreQueue = {
      enqueueRecompute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ProfileScoreQueueService>;

    const db = {
      transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        // Provide a tx stub whose .update().set().where() chain is a no-op.
        const tx = {
          update: () => ({
            set: () => ({
              where: () => Promise.resolve(undefined),
            }),
          }),
        };
        return fn(tx);
      }),
    } as unknown as jest.Mocked<DrizzleClient>;

    const svc = new ResumesService(
      repo,
      storage,
      parser,
      audit,
      docxToPdf,
      matchPreviewQueue,
      profileScoreQueue,
      db,
    );
    return {
      svc,
      repo,
      storage,
      parser,
      audit,
      docxToPdf,
      matchPreviewQueue,
      profileScoreQueue,
      db,
    };
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

  function buildSvc(opts: { initialResume: Resume; parserImpl?: jest.Mock }) {
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
      cancelByResumeId: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<MatchPreviewQueueService>;

    const profileScoreQueue = {
      enqueueRecompute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ProfileScoreQueueService>;

    const db = {
      transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          update: () => ({
            set: () => ({
              where: () => Promise.resolve(undefined),
            }),
          }),
        };
        return fn(tx);
      }),
    } as unknown as jest.Mocked<DrizzleClient>;

    const svc = new ResumesService(
      repo,
      storage,
      parser,
      audit,
      docxToPdf,
      matchPreviewQueue,
      profileScoreQueue,
      db,
    );
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
    const parserImpl = jest
      .fn()
      .mockRejectedValue(new Error("OpenAI rate limit"));
    const { svc, repo, audit } = buildSvc({
      initialResume: initial,
      parserImpl,
    });

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
      signedUrl: jest.fn(
        async ({ path }: { path: string }) => `signed:${path}`,
      ),
    } as unknown as jest.Mocked<StorageService>;

    const parser = {} as unknown as jest.Mocked<ParseResumeService>;
    const audit = {} as unknown as jest.Mocked<AuditService>;
    const docxToPdf = {} as unknown as jest.Mocked<DocxToPdfService>;
    const matchPreviewQueue =
      {} as unknown as jest.Mocked<MatchPreviewQueueService>;

    const profileScoreQueue =
      {} as unknown as jest.Mocked<ProfileScoreQueueService>;

    const db = {
      transaction: jest.fn(),
    } as unknown as jest.Mocked<DrizzleClient>;

    const svc = new ResumesService(
      repo,
      storage,
      parser,
      audit,
      docxToPdf,
      matchPreviewQueue,
      profileScoreQueue,
      db,
    );
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

describe("ResumesService.setDefault — default change cascade", () => {
  const candidateUser: AuthUser = {
    id: "11111111-1111-1111-1111-111111111111",
    email: "candidate@example.com",
    role: "candidate",
    status: "active",
    fullName: "Test Candidate",
    profileCompleted: true,
  };

  const R1_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const R2_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  function buildResume(id: string, isDefault: boolean): Resume {
    return {
      id,
      candidateId: candidateUser.id,
      filename: `${id}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 100,
      storagePath: `${candidateUser.id}/${id}.pdf`,
      canonicalPdfPath: null,
      rawText: null,
      parsedData: null,
      parseStatus: "parsed",
      parseError: null,
      isDefault,
      createdAt: new Date("2026-05-05T00:00:00Z"),
      updatedAt: new Date("2026-05-05T00:00:00Z"),
    };
  }

  function buildSvc() {
    // Track stale_at writes triggered through the tx stub so the test can
    // assert the profile_scores update fired.
    const profileScoresStaleCalls: Array<{ staleAt: Date }> = [];

    const repo = {
      findById: jest.fn(async (id: string) =>
        id === R1_ID
          ? buildResume(R1_ID, true)
          : id === R2_ID
            ? buildResume(R2_ID, false)
            : null,
      ),
      findDefaultByCandidateId: jest
        .fn()
        .mockResolvedValue(buildResume(R1_ID, true)),
      setDefault: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ResumesRepository>;

    const storage = {} as unknown as jest.Mocked<StorageService>;
    const parser = {} as unknown as jest.Mocked<ParseResumeService>;

    const audit = {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;

    const docxToPdf = {} as unknown as jest.Mocked<DocxToPdfService>;

    const matchPreviewQueue = {
      enqueuePrecompute: jest.fn().mockResolvedValue(undefined),
      cancelByResumeId: jest.fn().mockResolvedValue(1),
    } as unknown as jest.Mocked<MatchPreviewQueueService>;

    const profileScoreQueue = {
      enqueueRecompute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ProfileScoreQueueService>;

    // Tx stub that records calls into update(profileScoresTable).set(...)
    const tx = {
      update: jest.fn(() => ({
        set: jest.fn((patch: { staleAt: Date }) => {
          profileScoresStaleCalls.push(patch);
          return {
            where: jest.fn().mockResolvedValue(undefined),
          };
        }),
      })),
    };

    const db = {
      transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(tx);
      }),
    } as unknown as jest.Mocked<DrizzleClient>;

    const svc = new ResumesService(
      repo,
      storage,
      parser,
      audit,
      docxToPdf,
      matchPreviewQueue,
      profileScoreQueue,
      db,
    );
    return {
      svc,
      repo,
      audit,
      matchPreviewQueue,
      profileScoreQueue,
      db,
      profileScoresStaleCalls,
    };
  }

  it("on default change: marks profile_scores stale, cancels old in-flight jobs, enqueues new recompute jobs", async () => {
    const {
      svc,
      repo,
      matchPreviewQueue,
      profileScoreQueue,
      db,
      profileScoresStaleCalls,
    } = buildSvc();

    await svc.setDefault(candidateUser, R2_ID);

    // Old default looked up
    expect(repo.findDefaultByCandidateId).toHaveBeenCalledWith(
      candidateUser.id,
    );

    // Default flip happened (with tx forwarded so it's atomic with stale_at)
    expect(repo.setDefault).toHaveBeenCalledTimes(1);
    expect(repo.setDefault).toHaveBeenCalledWith(
      candidateUser.id,
      R2_ID,
      expect.anything(),
    );

    // Old in-flight jobs cancelled by resume id
    expect(matchPreviewQueue.cancelByResumeId).toHaveBeenCalledTimes(1);
    expect(matchPreviewQueue.cancelByResumeId).toHaveBeenCalledWith(R1_ID);

    // profile_scores stale_at write fired inside the transaction
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(profileScoresStaleCalls).toHaveLength(1);
    expect(profileScoresStaleCalls[0]?.staleAt).toBeInstanceOf(Date);

    // New recompute jobs enqueued for the NEW resume
    expect(profileScoreQueue.enqueueRecompute).toHaveBeenCalledWith({
      candidateId: candidateUser.id,
      resumeId: R2_ID,
      reason: "resume_change",
    });
    expect(matchPreviewQueue.enqueuePrecompute).toHaveBeenCalledWith({
      candidateId: candidateUser.id,
      resumeId: R2_ID,
    });
  });

  it("does not cancel old jobs when there is no previous default (first set-default)", async () => {
    const { svc, repo, matchPreviewQueue, profileScoreQueue } = buildSvc();
    (repo.findDefaultByCandidateId as jest.Mock).mockResolvedValue(null);

    await svc.setDefault(candidateUser, R2_ID);

    expect(matchPreviewQueue.cancelByResumeId).not.toHaveBeenCalled();
    // Recompute still enqueued — first-time default still needs the score.
    expect(profileScoreQueue.enqueueRecompute).toHaveBeenCalledTimes(1);
    expect(matchPreviewQueue.enqueuePrecompute).toHaveBeenCalledTimes(1);
  });

  it("does not cancel jobs when the same resume is re-set as default (no-op cascade still safe)", async () => {
    const { svc, repo, matchPreviewQueue, profileScoreQueue } = buildSvc();
    (repo.findDefaultByCandidateId as jest.Mock).mockResolvedValue(
      buildResume(R2_ID, true),
    );
    // Make findById return R2 so the auth check passes.
    (repo.findById as jest.Mock).mockResolvedValue(buildResume(R2_ID, true));

    await svc.setDefault(candidateUser, R2_ID);

    // No cancellation: previous == new, so cancelling would kill the job
    // we're about to re-enqueue.
    expect(matchPreviewQueue.cancelByResumeId).not.toHaveBeenCalled();
    expect(profileScoreQueue.enqueueRecompute).toHaveBeenCalledTimes(1);
    expect(matchPreviewQueue.enqueuePrecompute).toHaveBeenCalledTimes(1);
  });

  it("rejects when the target resume belongs to a different candidate", async () => {
    const { svc, repo } = buildSvc();
    (repo.findById as jest.Mock).mockResolvedValue({
      ...buildResume(R2_ID, false),
      candidateId: "99999999-9999-9999-9999-999999999999",
    });

    await expect(svc.setDefault(candidateUser, R2_ID)).rejects.toMatchObject({
      response: expect.objectContaining({ code: "NOT_FOUND" }),
    });
  });
});

describe("ResumesService.delete — default delete cascade", () => {
  const candidateUser: AuthUser = {
    id: "11111111-1111-1111-1111-111111111111",
    email: "candidate@example.com",
    role: "candidate",
    status: "active",
    fullName: "Test Candidate",
    profileCompleted: true,
  };

  const R1_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1";
  const R2_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2";
  const R3_ID = "cccccccc-cccc-cccc-cccc-ccccccccccc3";

  function buildResume(
    id: string,
    isDefault: boolean,
    daysAgo: number,
  ): Resume {
    const ts = new Date(Date.now() - daysAgo * 86400_000);
    return {
      id,
      candidateId: candidateUser.id,
      filename: `${id}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 100,
      storagePath: `${candidateUser.id}/${id}.pdf`,
      canonicalPdfPath: null,
      rawText: null,
      parsedData: null,
      parseStatus: "parsed",
      parseError: null,
      isDefault,
      createdAt: ts,
      updatedAt: ts,
    };
  }

  function buildSvc(opts: {
    targetResume: Resume;
    replacement: Resume | null;
  }) {
    const profileScoresStaleCalls: Array<{ staleAt: Date }> = [];
    const innerTxDeleteCalls: string[] = [];

    const repo = {
      findById: jest.fn(async (_id: string) => opts.targetResume),
      findReplacementCandidate: jest.fn(async () => opts.replacement),
      setDefault: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ResumesRepository>;

    const storage = {
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<StorageService>;

    const parser = {} as unknown as jest.Mocked<ParseResumeService>;

    const audit = {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;

    const docxToPdf = {} as unknown as jest.Mocked<DocxToPdfService>;

    const matchPreviewQueue = {
      enqueuePrecompute: jest.fn().mockResolvedValue(undefined),
      cancelByResumeId: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<MatchPreviewQueueService>;

    const profileScoreQueue = {
      enqueueRecompute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ProfileScoreQueueService>;

    // Tx stub records both the inner hard-delete (tx.delete().where()) and
    // the profile_scores stale_at update.
    const tx = {
      update: jest.fn(() => ({
        set: jest.fn((patch: { staleAt: Date }) => {
          profileScoresStaleCalls.push(patch);
          return { where: jest.fn().mockResolvedValue(undefined) };
        }),
      })),
      delete: jest.fn(() => ({
        where: jest.fn(async () => {
          innerTxDeleteCalls.push("delete");
          return undefined;
        }),
      })),
    };

    const db = {
      transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(tx);
      }),
    } as unknown as jest.Mocked<DrizzleClient>;

    const svc = new ResumesService(
      repo,
      storage,
      parser,
      audit,
      docxToPdf,
      matchPreviewQueue,
      profileScoreQueue,
      db,
    );
    return {
      svc,
      repo,
      storage,
      audit,
      matchPreviewQueue,
      profileScoreQueue,
      db,
      profileScoresStaleCalls,
      innerTxDeleteCalls,
      tx,
    };
  }

  it("delete-default with replacement: auto-promotes replacement and triggers recompute chain", async () => {
    const target = buildResume(R3_ID, true, 0); // today, default
    const replacement = buildResume(R2_ID, false, 1); // 1 day ago — most recent remaining
    const {
      svc,
      repo,
      storage,
      matchPreviewQueue,
      profileScoreQueue,
      db,
      profileScoresStaleCalls,
      innerTxDeleteCalls,
    } = buildSvc({ targetResume: target, replacement });

    await svc.delete(candidateUser, R3_ID);

    // Looked up the replacement, excluding the resume being deleted.
    expect(repo.findReplacementCandidate).toHaveBeenCalledWith(
      candidateUser.id,
      R3_ID,
    );

    // Storage object removed for the deleted resume.
    expect(storage.delete).toHaveBeenCalledWith({
      bucket: "resumes",
      path: target.storagePath,
    });

    // Inner tx hard-deletes the old default and then promotes the replacement.
    expect(innerTxDeleteCalls).toHaveLength(1);
    expect(repo.setDefault).toHaveBeenCalledWith(
      candidateUser.id,
      R2_ID,
      expect.anything(),
    );

    // Cascade: cancelled old in-flight jobs, marked profile_scores stale,
    // enqueued recompute jobs against the NEW default.
    expect(matchPreviewQueue.cancelByResumeId).toHaveBeenCalledWith(R3_ID);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(profileScoresStaleCalls).toHaveLength(1);
    expect(profileScoresStaleCalls[0]?.staleAt).toBeInstanceOf(Date);
    expect(profileScoreQueue.enqueueRecompute).toHaveBeenCalledWith({
      candidateId: candidateUser.id,
      resumeId: R2_ID,
      reason: "resume_change",
    });
    expect(matchPreviewQueue.enqueuePrecompute).toHaveBeenCalledWith({
      candidateId: candidateUser.id,
      resumeId: R2_ID,
    });
  });

  it("delete-default with last resume: returns 409 LAST_RESUME_PROTECTED", async () => {
    const target = buildResume(R1_ID, true, 0);
    const { svc, storage, repo, matchPreviewQueue, profileScoreQueue } =
      buildSvc({ targetResume: target, replacement: null });

    await expect(svc.delete(candidateUser, R1_ID)).rejects.toMatchObject({
      response: expect.objectContaining({ code: "LAST_RESUME_PROTECTED" }),
      status: 409,
    });

    // No side effects — storage untouched, repo.setDefault never called,
    // queues never enqueued.
    expect(storage.delete).not.toHaveBeenCalled();
    expect(repo.setDefault).not.toHaveBeenCalled();
    expect(matchPreviewQueue.cancelByResumeId).not.toHaveBeenCalled();
    expect(profileScoreQueue.enqueueRecompute).not.toHaveBeenCalled();
    expect(matchPreviewQueue.enqueuePrecompute).not.toHaveBeenCalled();
  });

  it("delete-non-default: standard delete; no promotion, no recompute trigger", async () => {
    const target = buildResume(R2_ID, false, 0);
    const { svc, repo, storage, matchPreviewQueue, profileScoreQueue, db } =
      buildSvc({ targetResume: target, replacement: null });

    await svc.delete(candidateUser, R2_ID);

    // Standard delete path — repo.delete (hard-delete) called, storage cleaned.
    expect(repo.delete).toHaveBeenCalledWith(R2_ID);
    expect(storage.delete).toHaveBeenCalledWith({
      bucket: "resumes",
      path: target.storagePath,
    });

    // No replacement lookup, no setDefault, no cascade.
    expect(repo.findReplacementCandidate).not.toHaveBeenCalled();
    expect(repo.setDefault).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
    expect(matchPreviewQueue.cancelByResumeId).not.toHaveBeenCalled();
    expect(profileScoreQueue.enqueueRecompute).not.toHaveBeenCalled();
    expect(matchPreviewQueue.enqueuePrecompute).not.toHaveBeenCalled();
  });
});
