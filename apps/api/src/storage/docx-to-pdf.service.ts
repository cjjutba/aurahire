import { Injectable, Logger } from "@nestjs/common";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TIMEOUT_MS = 30_000;
const SOFFICE_BIN = process.env.SOFFICE_BIN ?? "soffice";

export class DocxConversionError extends Error {
  constructor(
    message: string,
    public readonly stderr?: string,
  ) {
    super(message);
    this.name = "DocxConversionError";
  }
}

@Injectable()
export class DocxToPdfService {
  private readonly logger = new Logger(DocxToPdfService.name);
  // Serialize calls — LibreOffice doesn't share state cleanly across concurrent jobs.
  private mutex: Promise<unknown> = Promise.resolve();

  async convert(docxBuffer: Buffer): Promise<Buffer> {
    const release = await this.acquire();
    try {
      return await this.runConversion(docxBuffer);
    } finally {
      release();
    }
  }

  private acquire(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prev = this.mutex;
    this.mutex = prev.then(() => next);
    // Wait for prev holder to release before letting caller proceed.
    return prev.then(() => release);
  }

  private async runConversion(docxBuffer: Buffer): Promise<Buffer> {
    const workDir = await fs.mkdtemp(join(tmpdir(), `docx2pdf-${randomUUID()}-`));
    const inPath = join(workDir, "in.docx");
    const outPath = join(workDir, "in.pdf");

    try {
      await fs.writeFile(inPath, docxBuffer);

      await new Promise<void>((resolve, reject) => {
        const proc = spawn(SOFFICE_BIN, [
          "--headless",
          "--convert-to",
          "pdf",
          "--outdir",
          workDir,
          inPath,
        ]);

        let stderr = "";
        proc.stderr.on("data", (d: Buffer) => {
          stderr += d.toString();
        });

        const timer = setTimeout(() => {
          proc.kill("SIGKILL");
          reject(new DocxConversionError("LibreOffice conversion timed out", stderr));
        }, TIMEOUT_MS);

        proc.on("close", (code: number) => {
          clearTimeout(timer);
          if (code === 0) resolve();
          else reject(new DocxConversionError(`soffice exited with code ${code}`, stderr));
        });

        proc.on("error", (err: Error) => {
          clearTimeout(timer);
          reject(new DocxConversionError(`Failed to spawn soffice: ${err.message}`));
        });
      });

      const pdfBuffer = await fs.readFile(outPath);
      this.logger.log(`Converted DOCX (${docxBuffer.length}B) -> PDF (${pdfBuffer.length}B)`);
      return pdfBuffer;
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
