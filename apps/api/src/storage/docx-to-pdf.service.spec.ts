import { EventEmitter } from "node:events";
import { DocxToPdfService, DocxConversionError } from "./docx-to-pdf.service";

jest.mock("node:child_process");
import { spawn } from "node:child_process";

jest.mock("node:fs/promises", () => ({
  __esModule: true,
  mkdtemp: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  rm: jest.fn(),
}));
import * as fs from "node:fs/promises";

const spawnMock = spawn as unknown as jest.Mock;
const mkdtempMock = fs.mkdtemp as unknown as jest.Mock;
const writeFileMock = fs.writeFile as unknown as jest.Mock;
const readFileMock = fs.readFile as unknown as jest.Mock;
const rmMock = fs.rm as unknown as jest.Mock;

describe("DocxToPdfService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("converts a docx buffer to a pdf buffer via soffice", async () => {
    const mockProc = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: jest.Mock;
    };
    mockProc.stdout = new EventEmitter();
    mockProc.stderr = new EventEmitter();
    mockProc.kill = jest.fn();
    spawnMock.mockReturnValue(mockProc);

    const fakePdf = Buffer.from("%PDF-1.4 fake");
    mkdtempMock.mockResolvedValueOnce("/tmp/docx2pdf-test");
    writeFileMock.mockResolvedValueOnce(undefined);
    readFileMock.mockResolvedValueOnce(fakePdf);
    rmMock.mockResolvedValue(undefined);

    const svc = new DocxToPdfService();
    const promise = svc.convert(Buffer.from("docx content"));
    setImmediate(() => mockProc.emit("close", 0));

    const result = await promise;
    expect(result.equals(fakePdf)).toBe(true);
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it("throws DocxConversionError on non-zero exit", async () => {
    const mockProc = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: jest.Mock;
    };
    mockProc.stdout = new EventEmitter();
    mockProc.stderr = new EventEmitter();
    mockProc.kill = jest.fn();
    spawnMock.mockReturnValue(mockProc);

    mkdtempMock.mockResolvedValueOnce("/tmp/docx2pdf-test");
    writeFileMock.mockResolvedValueOnce(undefined);
    rmMock.mockResolvedValue(undefined);

    const svc = new DocxToPdfService();
    const promise = svc.convert(Buffer.from("docx"));
    setImmediate(() => mockProc.emit("close", 1));

    await expect(promise).rejects.toThrow(DocxConversionError);
  });

  it("serializes concurrent conversions", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    spawnMock.mockImplementation(() => {
      const proc = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        kill: jest.Mock;
      };
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      proc.kill = jest.fn();
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      setImmediate(() => {
        inFlight--;
        proc.emit("close", 0);
      });
      return proc;
    });

    let dirCounter = 0;
    mkdtempMock.mockImplementation(async () => `/tmp/dir-${dirCounter++}`);
    writeFileMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue(Buffer.from("%PDF"));
    rmMock.mockResolvedValue(undefined);

    const svc = new DocxToPdfService();
    await Promise.all([
      svc.convert(Buffer.from("a")),
      svc.convert(Buffer.from("b")),
      svc.convert(Buffer.from("c")),
    ]);
    expect(maxInFlight).toBe(1);
    expect(spawnMock).toHaveBeenCalledTimes(3);
  });
});
