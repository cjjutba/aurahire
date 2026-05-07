// apps/web/components/onboarding/candidate/resume-upload-card.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { ParsingProgressCard } from "./parsing-progress-card";
import { ParseSuccessCard } from "./parse-success-card";
import { ResumeStaleRecoveryCard } from "./resume-stale-recovery-card";
import type { LatestParsedResume } from "@/app/onboarding/candidate/_steps";

const ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 10 * 1024 * 1024;

interface Props {
  latestResume: LatestParsedResume | null;
  accessToken: string;
}

type Stage = "idle" | "uploading" | "done" | "failed";

export function ResumeUploadCard({ latestResume, accessToken }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  // Initial stage based on existing resume row.
  const [stage, setStage] = useState<Stage>(
    latestResume?.parseStatus === "parsed"
      ? "done"
      : latestResume?.parseStatus === "failed"
        ? "failed"
        : "idle",
  );
  const [resume, setResume] = useState<LatestParsedResume | null>(latestResume);
  const [activeFile, setActiveFile] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);

  // Stale "parsing" recovery state — render the recovery card.
  if (latestResume?.parseStatus === "parsing" && stage !== "uploading") {
    return (
      <ResumeStaleRecoveryCard
        resumeId={latestResume.id}
        accessToken={accessToken}
        onReparseTriggered={() => router.refresh()}
        onUploadDifferent={() => {
          setResume(null);
          setStage("idle");
        }}
      />
    );
  }

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("File exceeds 10MB. Try compressing or use a different file.");
      return;
    }
    setActiveFile({ name: file.name, size: file.size, type: file.type });
    setStage("uploading");
    const fd = new FormData();
    fd.append("file", file);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
    try {
      const res = await fetch(`${apiUrl}/api/v1/resumes/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? `Upload failed (${res.status})`);
        setStage("idle");
        return;
      }
      const body = (await res.json()) as {
        data: {
          id: string;
          parseStatus: "parsed" | "failed" | "parsing" | "pending";
          parsedData: LatestParsedResume["parsed"];
          rawText: string | null;
          canonicalPdfPath: string | null;
        };
      };
      if (body.data.parseStatus === "parsed") {
        setResume({
          id: body.data.id,
          parseStatus: "parsed",
          signedPdfUrl: null,
          rawText: body.data.rawText,
          canonicalPdfPath: body.data.canonicalPdfPath,
          parsed: body.data.parsedData,
        });
        setStage("done");
        router.refresh();
      } else if (body.data.parseStatus === "failed") {
        setStage("failed");
        router.refresh();
      }
    } catch (err) {
      setError((err as Error).message);
      setStage("idle");
    }
  };

  if (stage === "uploading") {
    return (
      <div>
        <p className="mb-3 text-xs text-[var(--color-muted)]">
          Hang tight — this usually takes 5–15 seconds.
        </p>
        <ParsingProgressCard file={activeFile} />
      </div>
    );
  }

  if (stage === "done" && resume) {
    return <ParseSuccessCard parsed={resume.parsed} />;
  }

  if (stage === "failed") {
    return (
      <div>
        <p className="text-sm font-semibold text-[var(--color-status-danger)]">
          We couldn&apos;t parse this resume.
        </p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Try a different file or continue without parsing.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => router.push("/onboarding/candidate/personal")}
            className="rounded-full bg-[var(--color-surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-hairline)]"
          >
            Continue without parsing
          </button>
          <button
            onClick={() => setStage("idle")}
            className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-active)]"
          >
            Try a different file
          </button>
        </div>
      </div>
    );
  }

  // idle
  return (
    <div>
      <label
        className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)] p-8 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/30"
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
      >
        <UploadCloud className="h-10 w-10 text-[var(--color-muted)]" />
        <p className="mt-3 text-sm font-semibold">Drop your resume here, or click to browse</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">PDF or DOCX · 10MB max</p>
        <input
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>
      {error && <p className="mt-3 text-sm text-[var(--color-status-danger)]">{error}</p>}
      <button
        onClick={() => router.push("/onboarding/candidate/personal")}
        className="mt-5 text-sm text-[var(--color-muted)] underline transition-colors hover:text-[var(--color-ink)]"
      >
        Skip — I&apos;ll fill in manually
      </button>
    </div>
  );
}
