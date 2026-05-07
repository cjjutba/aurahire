"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, FileText, Loader2, Sparkles, Star } from "lucide-react";

import { AiShimmer } from "@/components/ai/ai-shimmer";
import { Textarea } from "@/components/ui/textarea";
import {
  ApplyMatchSummary,
  type ApplyMatchPreview,
} from "@/components/score/apply-match-summary";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { toastSuccess, toastApiError } from "@/lib/toast";

interface ResumeOption {
  id: string;
  filename: string;
  isDefault: boolean;
  parseStatus: string;
  sizeBytes: number;
  createdAt: string;
}

interface Props {
  jobId: string;
  resumes: ResumeOption[];
  preview: ApplyMatchPreview | null;
}

const COVER_LETTER_MAX = 5000;

export function ApplyFormClient({ jobId, resumes, preview }: Props) {
  const router = useRouter();
  const defaultResumeId =
    resumes.find((r) => r.isDefault)?.id ?? resumes[0]?.id ?? "";
  const [resumeId, setResumeId] = useState<string>(defaultResumeId);
  const [coverLetter, setCoverLetter] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const charsLeft = COVER_LETTER_MAX - coverLetter.length;
  const overLimit = charsLeft < 0;

  const selectedResumeMatchesPreview =
    preview !== null && preview.resumeId === resumeId;

  function switchToPreviewResume() {
    if (preview) setResumeId(preview.resumeId);
  }

  async function submit() {
    if (!resumeId) {
      toastApiError(null, "Check your input", "Please pick a resume to apply with.");
      return;
    }
    if (overLimit) {
      toastApiError(
        null,
        "Cover letter too long",
        `Please trim to ${COVER_LETTER_MAX.toLocaleString()} characters or less.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toastApiError(null, "Couldn't apply", "Please sign in again.");
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const res = await fetch(`${apiUrl}/api/v1/applications`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId,
          resumeId,
          coverLetter: coverLetter || null,
        }),
      });

      if (res.status === 409) {
        // Race condition: server-side guard caught a duplicate even though
        // the apply page hard block let the user through. Push them back to
        // the job detail; the next render will reflect the applied state.
        toastApiError(
          null,
          "Already applied",
          "You've already applied to this job. Redirecting…",
        );
        router.replace(`/candidate/jobs/${jobId}`);
        router.refresh();
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        toastApiError(null, "Couldn't apply", body.message ?? "Please try again.");
        return;
      }

      const body = (await res.json()) as { data: { id: string } };
      toastSuccess("Application sent", "We'll notify you when there's an update.");
      router.push(`/candidate/applications/${body.data.id}`);
    } catch (err) {
      toastApiError(err, "Couldn't apply");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitting) {
    if (preview && selectedResumeMatchesPreview) {
      return (
        <div
          role="status"
          aria-busy={true}
          className="flex items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-sm text-[var(--color-body)]"
        >
          <Loader2
            className="h-4 w-4 animate-spin text-[var(--color-primary)]"
            aria-hidden
          />
          <span>Submitting application…</span>
        </div>
      );
    }
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-8">
        <AiShimmer
          caption="Computing your match against this job — analyzing skills, experience, education, and cultural fit..."
          height={240}
        />
      </div>
    );
  }

  return (
    <>
      {preview && (
        <ApplyMatchSummary
          preview={preview}
          selectedResumeMatchesPreview={selectedResumeMatchesPreview}
          onSwitchToPreviewResume={switchToPreviewResume}
        />
      )}

      {/* Resume picker card */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-ink)]">
              Choose a resume
            </h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Required · pick the one most relevant to this role.
            </p>
          </div>
          <Link
            href="/candidate/resume"
            className="text-xs font-medium text-[var(--color-primary)] underline-offset-2 hover:underline"
          >
            Manage resumes
          </Link>
        </div>

        <div className="mt-5 space-y-2.5">
          {resumes.map((r) => (
            <ResumeOptionCard
              key={r.id}
              resume={r}
              selected={r.id === resumeId}
              onSelect={() => setResumeId(r.id)}
            />
          ))}
        </div>
      </section>

      <ResumeMatchBanner
        preview={preview}
        selectedResumeMatchesPreview={selectedResumeMatchesPreview}
      />

      {/* Cover letter card */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-ink)]">
              Cover letter
            </h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Optional · 2–3 short paragraphs is plenty.
            </p>
          </div>
          <span
            className={[
              "font-mono text-xs",
              overLimit
                ? "text-[var(--color-status-danger)]"
                : charsLeft < 200
                  ? "text-[var(--color-score-mid)]"
                  : "text-[var(--color-muted)]",
            ].join(" ")}
            aria-live="polite"
          >
            {coverLetter.length.toLocaleString()} /{" "}
            {COVER_LETTER_MAX.toLocaleString()}
          </span>
        </div>

        <Textarea
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          placeholder="Why are you a great fit for this role?"
          rows={8}
          className="mt-4"
          aria-invalid={overLimit || undefined}
        />

        <ul className="mt-4 space-y-1.5 text-xs text-[var(--color-muted)]">
          <Tip>Lead with the most relevant experience for this role.</Tip>
          <Tip>Mention specific skills the job calls out.</Tip>
          <Tip>Skip the generic pitch — recruiters skim.</Tip>
        </ul>
      </section>

      {/* Desktop action bar */}
      <div className="hidden items-center justify-end gap-3 lg:flex">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-11 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-soft)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!resumeId || overLimit}
          className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)] disabled:cursor-not-allowed disabled:bg-[var(--color-primary-disabled)]"
        >
          <Sparkles className="h-4 w-4" />
          {preview && selectedResumeMatchesPreview
            ? "Lock in match & apply"
            : "Submit application"}
        </button>
      </div>

      {/* Mobile sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-[var(--color-hairline)] bg-[var(--color-canvas)]/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-11 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-soft)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!resumeId || overLimit}
          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-active)] disabled:cursor-not-allowed disabled:bg-[var(--color-primary-disabled)]"
        >
          <Sparkles className="h-4 w-4" />
          {preview && selectedResumeMatchesPreview ? "Lock in & apply" : "Submit"}
        </button>
      </div>
    </>
  );
}

function ResumeOptionCard({
  resume,
  selected,
  onSelect,
}: {
  resume: ResumeOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        "group flex w-full items-center gap-4 rounded-[var(--radius-md)] border p-4 text-left transition",
        selected
          ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]/40 ring-1 ring-[var(--color-primary)]"
          : "border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:border-[var(--color-muted-soft)] hover:bg-[var(--color-surface-soft)]",
      ].join(" ")}
    >
      <div
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-strong)] text-[var(--color-muted)]"
      >
        <FileText className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-[var(--color-ink)]">
            {displayFilename(resume.filename)}
          </p>
          {resume.isDefault && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
              <Star className="h-2.5 w-2.5" />
              Default
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-muted)]">
          <span className="font-mono">{formatBytes(resume.sizeBytes)}</span>
          <span aria-hidden>·</span>
          <span>Uploaded {relativeDate(resume.createdAt)}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1 text-[var(--color-status-success)]">
            <Check className="h-3 w-3" />
            Parsed
          </span>
        </div>
      </div>
      <span
        aria-hidden
        className={[
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-full)] border-2 transition",
          selected
            ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
            : "border-[var(--color-hairline)] bg-[var(--color-canvas)]",
        ].join(" ")}
      >
        {selected && <Check className="h-3 w-3" />}
      </span>
    </button>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden
        className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-[var(--radius-full)] bg-[var(--color-muted-soft)]"
      />
      <span>{children}</span>
    </li>
  );
}

function displayFilename(name: string): string {
  // Likely a UUID-ish raw upload name — show a friendly fallback.
  if (/^[0-9a-f-]{32,}$/i.test(name.replace(/\.[a-z0-9]+$/i, ""))) {
    return "Uploaded resume";
  }
  return name;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function relativeDate(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function ResumeMatchBanner({
  preview,
  selectedResumeMatchesPreview,
}: {
  preview: ApplyMatchPreview | null;
  selectedResumeMatchesPreview: boolean;
}) {
  if (preview && selectedResumeMatchesPreview) {
    return (
      <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] px-4 py-3 text-xs text-[var(--color-primary)]">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">
            Apply to lock in this score — no recompute needed.
          </strong>{" "}
          We&apos;ll attach the match preview shown above to your application.
        </span>
      </div>
    );
  }
  if (preview && !selectedResumeMatchesPreview) {
    return (
      <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] bg-[var(--color-score-mid-soft)] px-4 py-3 text-xs text-[var(--color-score-mid)]">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">
            You picked a different resume than the one your match was scored
            against.
          </strong>{" "}
          We&apos;ll compute a fresh match when you submit.
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] px-4 py-3 text-xs text-[var(--color-body)]">
      <Sparkles
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-primary)]"
        aria-hidden
      />
      <span>
        <strong className="font-semibold text-[var(--color-ink)]">
          No match preview yet.
        </strong>{" "}
        We&apos;ll score your resume against this job when you submit.
      </span>
    </div>
  );
}
