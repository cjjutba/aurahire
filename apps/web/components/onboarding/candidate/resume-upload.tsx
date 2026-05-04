"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { toastSuccess, toastApiError } from "@/lib/toast";

import { AiShimmer } from "@/components/ai/ai-shimmer";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

const ACCEPTED =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 10 * 1024 * 1024;

type Phase = "idle" | "uploading" | "parsing" | "success" | "failed";

export function ResumeUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPdfOrDocx = (f: File) =>
    f.type === "application/pdf" ||
    f.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.(pdf|docx)$/i.test(f.name);

  const handleFile = (f: File) => {
    setErrorMessage(null);
    if (!isPdfOrDocx(f)) {
      setErrorMessage("Only PDF and DOCX files are accepted.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setErrorMessage(
        `File too large (${(f.size / 1024 / 1024).toFixed(1)}MB). Max 10MB.`,
      );
      return;
    }
    setFile(f);
  };

  const onUpload = async () => {
    if (!file) return;
    setPhase("uploading");
    setErrorMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toastApiError(null, "Please sign in again");
        setPhase("idle");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

      setPhase("parsing");

      const res = await fetch(`${apiUrl}/api/v1/resumes/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }

      const body = (await res.json()) as {
        data: { id: string; parseStatus: string };
      };

      if (body.data.parseStatus === "parsed") {
        setPhase("success");
        toastSuccess("Resume processed", "Review the prefilled fields before continuing.");
        router.push("/onboarding/candidate/personal");
        router.refresh();
      } else {
        setPhase("failed");
        setErrorMessage(
          "We couldn't parse this resume automatically. You can continue and fill out the form manually.",
        );
      }
    } catch (err) {
      setPhase("failed");
      setErrorMessage((err as Error).message);
    }
  };

  if (phase === "parsing") {
    return (
      <AiShimmer
        caption="AI is parsing your resume — extracting contact info, experience, education, and skills..."
        height={240}
      />
    );
  }

  if (phase === "uploading") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-8 text-center text-sm text-[var(--color-body)]">
        Uploading {file?.name}…
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-status-warning)] bg-[var(--color-score-mid-soft)] p-6 text-sm text-[var(--color-body)]">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--color-status-warning)]" />
          <div>
            <p className="font-semibold text-[var(--color-ink)]">
              Parse incomplete
            </p>
            <p className="mt-1">{errorMessage}</p>
            <div className="mt-4 flex gap-3">
              <Button
                onClick={() => {
                  setPhase("idle");
                  setFile(null);
                  setErrorMessage(null);
                }}
                variant="outline"
                className="rounded-[var(--radius-pill)]"
              >
                Try a different file
              </Button>
              <Button
                onClick={() => {
                  router.push("/onboarding/candidate/personal");
                }}
                className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
              >
                Continue manually
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
      >
        <Upload className="h-8 w-8 text-[var(--color-muted)]" />
        <p className="mt-3 text-sm font-medium text-[var(--color-ink)]">
          Drag and drop your resume here, or click to browse
        </p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          PDF or DOCX, up to 10MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      {file && (
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-[var(--color-primary)]" />
            <div>
              <p className="text-sm font-medium text-[var(--color-ink)]">
                {file.name}
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFile(null)}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            Remove
          </button>
        </div>
      )}

      {errorMessage && (
        <p className="text-sm text-[var(--color-status-danger)]">{errorMessage}</p>
      )}

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/onboarding/candidate/personal")}
          className="rounded-[var(--radius-pill)]"
        >
          Skip and fill manually
        </Button>
        <Button
          onClick={onUpload}
          disabled={!file}
          className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)] disabled:bg-[var(--color-primary-disabled)]"
        >
          Upload and parse
        </Button>
      </div>
    </div>
  );
}
