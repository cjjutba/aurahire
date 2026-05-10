// apps/web/components/onboarding/candidate/resume-stale-recovery-card.tsx
"use client";

import { useState } from "react";

interface Props {
  resumeId: string;
  accessToken: string;
  onReparseTriggered: () => void;
  onUploadDifferent: () => void;
}

export function ResumeStaleRecoveryCard({
  resumeId,
  accessToken,
  onReparseTriggered,
  onUploadDifferent,
}: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRetry = async () => {
    setError(null);
    setPending(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const res = await fetch(`${apiUrl}/api/v1/resumes/${resumeId}/reparse`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? `Reparse failed (${res.status})`);
        return;
      }
      onReparseTriggered();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--color-hairline)] p-6">
      <h2 className="text-xl font-normal text-[var(--color-ink)]">
        A previous upload didn&apos;t complete
      </h2>
      <p className="mt-2 text-sm text-[var(--color-body)]">
        We can pick up where it left off, or you can upload a different resume.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          disabled={pending}
          onClick={handleRetry}
          className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)] disabled:opacity-50"
        >
          {pending ? "Retrying…" : "Retry parse"}
        </button>
        <button
          onClick={onUploadDifferent}
          className="rounded-full bg-[var(--color-surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)]"
        >
          Upload a different file
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-[var(--color-status-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
