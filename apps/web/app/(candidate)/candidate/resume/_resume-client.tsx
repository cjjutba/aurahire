"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Award,
  Briefcase,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  RefreshCcw,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  User,
  Wrench,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  Certification,
  EducationEntry,
  ExperienceEntry,
  ParsedResume,
  ParsedResumeContact,
  SkillEntry,
} from "@aurahire/shared";
import { getAccessToken } from "@aurahire/shared";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/providers/confirm-provider";
import { queryKeys } from "@/lib/query";
import { toastApiError, toastSuccess } from "@/lib/toast";
import {
  useMyResumesQuery,
  useResumeSignedUrlQuery,
  type ResumeRow,
} from "@/hooks/use-resumes";

const ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 10 * 1024 * 1024;

type Tab = "pdf" | "parsed";

const PARSE_STATUS_META: Record<
  ResumeRow["parseStatus"],
  { label: string; dot: string; text: string }
> = {
  pending: {
    label: "Pending",
    dot: "bg-[var(--color-muted)]",
    text: "text-[var(--color-muted)]",
  },
  parsing: {
    label: "Parsing…",
    dot: "bg-[var(--color-status-info)]",
    text: "text-[var(--color-status-info)]",
  },
  parsed: {
    label: "Parsed",
    dot: "bg-[var(--color-status-success)]",
    text: "text-[var(--color-status-success)]",
  },
  failed: {
    label: "Parse failed",
    dot: "bg-[var(--color-status-danger)]",
    text: "text-[var(--color-status-danger)]",
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function apiCall<T>(
  path: string,
  init: { method?: "POST" | "DELETE" } = {},
): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const token = getAccessToken();
  const res = await fetch(`${apiUrl}${path}`, {
    method: init.method ?? "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = new Error(`API ${res.status}`) as Error & {
      body?: unknown;
      status?: number;
    };
    err.body = body;
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function uploadFile(file: File): Promise<ResumeRow> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const token = getAccessToken();
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${apiUrl}/api/v1/resumes/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
    credentials: "include",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { message?: string }
      | null;
    const err = new Error(body?.message ?? `Upload failed (${res.status})`) as Error & {
      body?: unknown;
    };
    err.body = body;
    throw err;
  }
  const body = (await res.json()) as { data: ResumeRow };
  return body.data;
}

interface UploadDropzoneProps {
  onUploaded: (row: ResumeRow) => void;
}

function UploadDropzone({ onUploaded }: UploadDropzoneProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("File exceeds 10 MB. Try compressing or use a different file.");
      return;
    }
    setBusy(true);
    try {
      const row = await uploadFile(file);
      toastSuccess(
        "Resume uploaded",
        row.parseStatus === "parsed"
          ? "AI parsing complete."
          : "AI parsing in progress…",
      );
      onUploaded(row);
    } catch (err) {
      toastApiError(err, "Upload failed");
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label
        className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed p-6 text-center transition ${
          dragOver
            ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]/40"
            : "border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/20"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) void handleFile(f);
        }}
      >
        {busy ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
            <p className="mt-3 text-sm font-medium text-[var(--color-ink)]">
              Uploading and parsing…
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Usually 5–15 seconds.
            </p>
          </>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-[var(--color-muted)]" />
            <p className="mt-3 text-sm font-medium text-[var(--color-ink)]">
              Drop a resume, or click to browse
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              PDF or DOCX · 10 MB max
            </p>
          </>
        )}
        <input
          type="file"
          accept={ACCEPT}
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
      </label>
      {error && (
        <p className="mt-2 text-xs text-[var(--color-status-danger)]">{error}</p>
      )}
    </div>
  );
}

interface ResumeListItemProps {
  resume: ResumeRow;
  selected: boolean;
  onSelect: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
  onReparse: () => void;
  onDownload: () => void;
  busyAction: string | null;
}

function ResumeListItem({
  resume,
  selected,
  onSelect,
  onSetDefault,
  onDelete,
  onReparse,
  onDownload,
  busyAction,
}: ResumeListItemProps) {
  const status = PARSE_STATUS_META[resume.parseStatus];
  return (
    <li>
      <div
        className={`group relative flex items-start gap-3 rounded-[var(--radius-lg)] border p-3 transition ${
          selected
            ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]/30"
            : "border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:border-[var(--color-primary-soft)]"
        }`}
      >
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium text-[var(--color-ink)]">
                {resume.filename}
              </p>
              {resume.isDefault && (
                <span
                  title="Default resume"
                  className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary)]"
                >
                  <Star className="h-2.5 w-2.5" />
                  Default
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--color-muted)]">
              <span>{formatBytes(resume.sizeBytes)}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                <span className={status.text}>{status.label}</span>
              </span>
              <span>·</span>
              <span>{formatDate(resume.createdAt)}</span>
            </div>
          </div>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Resume actions"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-muted)] hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)] disabled:opacity-50"
                disabled={Boolean(busyAction)}
              />
            }
          >
            {busyAction ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!resume.isDefault && (
              <DropdownMenuItem onClick={onSetDefault}>
                <Star className="mr-1.5 h-3.5 w-3.5" />
                Set as default
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onDownload}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download
            </DropdownMenuItem>
            {(resume.parseStatus === "failed" ||
              resume.parseStatus === "parsed") && (
              <DropdownMenuItem onClick={onReparse}>
                <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                Re-parse
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function AiSuggestedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
      <Sparkles className="h-2.5 w-2.5" />
      AI Suggested
    </span>
  );
}

function ParsedSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[var(--color-muted)]" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function ContactPanel({ contact }: { contact: ParsedResumeContact }) {
  const items: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string | null;
  }> = [
    { icon: User, label: "Full name", value: contact.full_name },
    { icon: Mail, label: "Email", value: contact.email },
    { icon: Phone, label: "Phone", value: contact.phone },
    {
      icon: MapPin,
      label: "Location",
      value:
        [contact.location_city, contact.location_country]
          .filter(Boolean)
          .join(", ") || null,
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              <Icon className="h-3 w-3" />
              {item.label}
            </div>
            <div className="mt-1 truncate text-sm text-[var(--color-ink)]">
              {item.value ?? (
                <span className="text-[var(--color-muted)]">Not detected</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExperiencePanel({ items }: { items: ExperienceEntry[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        No work experience extracted.
      </p>
    );
  }
  return (
    <ol className="space-y-4">
      {items.map((entry, idx) => (
        <li
          key={`${entry.company}-${idx}`}
          className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold text-[var(--color-ink)]">
              {entry.title}
            </h4>
            <span className="font-mono text-[11px] text-[var(--color-muted)]">
              {entry.period_source}
            </span>
          </div>
          <p className="text-sm text-[var(--color-body)]">{entry.company}</p>
          {entry.responsibilities.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[var(--color-body)]">
              {entry.responsibilities.slice(0, 5).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          {entry.technologies_used.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {entry.technologies_used.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink)]"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function EducationPanel({ items }: { items: EducationEntry[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]">No education extracted.</p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((entry, idx) => {
        const period = entry.period_source ?? "";
        const subtitle = [entry.degree, entry.field_of_study]
          .filter(Boolean)
          .join(" · ");
        return (
          <li
            key={`${entry.institution}-${idx}`}
            className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-semibold text-[var(--color-ink)]">
                {entry.institution}
              </h4>
              {period && (
                <span className="font-mono text-[11px] text-[var(--color-muted)]">
                  {period}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-[var(--color-body)]">{subtitle}</p>
            )}
            {entry.gpa && (
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                GPA: {entry.gpa}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SkillsPanel({ skills }: { skills: SkillEntry[] }) {
  if (skills.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]">No skills extracted.</p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((skill, idx) => (
        <span
          key={`${skill.name}-${idx}`}
          className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-primary-soft)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary)]"
        >
          {skill.name}
        </span>
      ))}
    </div>
  );
}

function CertificationsPanel({ items }: { items: Certification[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        No certifications extracted.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((cert, idx) => (
        <li
          key={`${cert.name}-${idx}`}
          className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3"
        >
          <p className="text-sm font-medium text-[var(--color-ink)]">{cert.name}</p>
          {(cert.issuing_organization || cert.issue_date) && (
            <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
              {[cert.issuing_organization, cert.issue_date]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function ParsedFieldsView({ resume }: { resume: ResumeRow }) {
  if (resume.parseStatus === "parsing" || resume.parseStatus === "pending") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
        <p className="mt-3 text-sm font-medium text-[var(--color-ink)]">
          AI is parsing your resume…
        </p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          This typically takes 5–15 seconds.
        </p>
      </div>
    );
  }

  if (resume.parseStatus === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="h-6 w-6 text-[var(--color-status-danger)]" />
        <p className="mt-3 text-sm font-medium text-[var(--color-ink)]">
          We couldn&apos;t parse this resume.
        </p>
        {resume.parseError && (
          <p className="mt-1 max-w-md text-xs text-[var(--color-muted)]">
            {resume.parseError}
          </p>
        )}
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          Try Re-parse from the row menu, or upload a different file.
        </p>
      </div>
    );
  }

  if (!resume.parsedData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="h-6 w-6 text-[var(--color-muted)]" />
        <p className="mt-3 text-sm font-medium text-[var(--color-ink)]">
          No parsed data available.
        </p>
      </div>
    );
  }

  const parsed = resume.parsedData;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--color-status-success)]" />
            <h2 className="text-base font-semibold text-[var(--color-ink)]">
              AI extraction complete
            </h2>
            <AiSuggestedBadge />
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Confidence: <span className="capitalize">{parsed.parse_confidence}</span>{" "}
            · {parsed.experience.length} role
            {parsed.experience.length === 1 ? "" : "s"} ·{" "}
            {parsed.skills.length} skill{parsed.skills.length === 1 ? "" : "s"} ·{" "}
            {parsed.education.length} education entr
            {parsed.education.length === 1 ? "y" : "ies"}
          </p>
        </div>
      </div>

      <ParsedSection icon={User} title="Contact">
        <ContactPanel contact={parsed.contact} />
      </ParsedSection>

      {parsed.summary && (
        <ParsedSection icon={FileText} title="Summary">
          <p className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4 text-sm text-[var(--color-body)]">
            {parsed.summary.text}
          </p>
        </ParsedSection>
      )}

      <ParsedSection icon={Briefcase} title="Experience">
        <ExperiencePanel items={parsed.experience} />
      </ParsedSection>

      <ParsedSection icon={GraduationCap} title="Education">
        <EducationPanel items={parsed.education} />
      </ParsedSection>

      <ParsedSection icon={Wrench} title={`Skills (${parsed.skills.length})`}>
        <SkillsPanel skills={parsed.skills} />
      </ParsedSection>

      {parsed.certifications.length > 0 && (
        <ParsedSection icon={Award} title="Certifications">
          <CertificationsPanel items={parsed.certifications} />
        </ParsedSection>
      )}
    </div>
  );
}

function PdfPreviewView({ resumeId }: { resumeId: string }) {
  const { data, isLoading, isError } = useResumeSignedUrlQuery(resumeId);
  const url = data?.data.signedPdfUrl ?? data?.data.signedUrl;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }
  if (isError || !url) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="h-6 w-6 text-[var(--color-status-danger)]" />
        <p className="mt-3 text-sm font-medium text-[var(--color-ink)]">
          Couldn&apos;t load preview.
        </p>
      </div>
    );
  }

  return (
    <iframe
      src={url}
      title="Resume preview"
      className="h-[calc(100vh-260px)] min-h-[520px] w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)]"
    />
  );
}

interface PreviewPaneProps {
  resume: ResumeRow;
}

function PreviewPane({ resume }: PreviewPaneProps) {
  const [tab, setTab] = useState<Tab>("parsed");
  const status = PARSE_STATUS_META[resume.parseStatus];

  // When the user picks a different resume that hasn't been parsed, default
  // them to the PDF tab so they don't land on an empty parsed-fields view.
  useEffect(() => {
    if (resume.parseStatus !== "parsed") setTab("pdf");
    else setTab("parsed");
  }, [resume.id, resume.parseStatus]);

  const isPdf = resume.mimeType === "application/pdf";

  return (
    <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-hairline)] p-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-[var(--color-ink)]">
            {resume.filename}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--color-muted)]">
            <span>{formatBytes(resume.sizeBytes)}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              <span className={status.text}>{status.label}</span>
            </span>
            <span>·</span>
            <span>Uploaded {formatDate(resume.createdAt)}</span>
            {resume.isDefault && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-[var(--color-primary)]">
                  <Star className="h-3 w-3" />
                  Default
                </span>
              </>
            )}
          </div>
        </div>
        <div className="inline-flex rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] p-0.5">
          <button
            type="button"
            onClick={() => setTab("parsed")}
            disabled={resume.parseStatus !== "parsed"}
            className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              tab === "parsed"
                ? "bg-[var(--color-canvas)] text-[var(--color-ink)] shadow-sm"
                : "text-[var(--color-muted)]"
            }`}
          >
            <Sparkles className="h-3 w-3" />
            Parsed Fields
          </button>
          <button
            type="button"
            onClick={() => setTab("pdf")}
            disabled={!isPdf}
            className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              tab === "pdf"
                ? "bg-[var(--color-canvas)] text-[var(--color-ink)] shadow-sm"
                : "text-[var(--color-muted)]"
            }`}
            title={isPdf ? "View original PDF" : "Preview only available for PDFs"}
          >
            <Eye className="h-3 w-3" />
            PDF View
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "pdf" ? (
          isPdf ? (
            <PdfPreviewView resumeId={resume.id} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-6 w-6 text-[var(--color-muted)]" />
              <p className="mt-3 text-sm font-medium text-[var(--color-ink)]">
                Preview not available for {resume.mimeType}.
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                DOCX previews aren&apos;t supported in-browser. Download to view.
              </p>
            </div>
          )
        ) : (
          <ParsedFieldsView resume={resume} />
        )}
      </div>
    </div>
  );
}

export function CandidateResumeClient() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useMyResumesQuery();
  const resumes = useMemo(() => data?.data ?? [], [data]);

  const confirm = useConfirm();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<{
    id: string;
    action: string;
  } | null>(null);
  const justUploadedIdRef = useRef<string | null>(null);

  // Auto-select default → first resume → newly uploaded resume.
  useEffect(() => {
    if (resumes.length === 0) {
      setSelectedId(null);
      return;
    }
    if (justUploadedIdRef.current) {
      const candidate = resumes.find((r) => r.id === justUploadedIdRef.current);
      if (candidate) {
        setSelectedId(candidate.id);
        justUploadedIdRef.current = null;
        return;
      }
    }
    if (selectedId && resumes.some((r) => r.id === selectedId)) return;
    const def = resumes.find((r) => r.isDefault);
    setSelectedId((def ?? resumes[0])?.id ?? null);
  }, [resumes, selectedId]);

  const selected = resumes.find((r) => r.id === selectedId) ?? null;

  function invalidate() {
    return qc.invalidateQueries({ queryKey: queryKeys.candidateResumes.list() });
  }

  async function setDefault(resume: ResumeRow) {
    if (resume.isDefault) return;
    const ok = await confirm({
      title: "Set as default resume?",
      description: `${resume.filename} will be used the next time you apply to a job.`,
      confirmLabel: "Set as default",
      variant: "info",
    });
    if (!ok) return;
    setBusyAction({ id: resume.id, action: "default" });
    try {
      await apiCall(`/api/v1/resumes/${resume.id}/set-default`);
      toastSuccess("Default resume updated");
      await invalidate();
    } catch (err) {
      toastApiError(err, "Couldn't set default");
    } finally {
      setBusyAction(null);
    }
  }

  async function reparse(resume: ResumeRow) {
    const ok = await confirm({
      title: "Re-parse this resume?",
      description:
        "AI will re-extract skills, experience, and education from this resume. The current parsed data will be overwritten.",
      confirmLabel: "Re-parse resume",
      variant: "warning",
    });
    if (!ok) return;
    setBusyAction({ id: resume.id, action: "reparse" });
    try {
      await apiCall(`/api/v1/resumes/${resume.id}/reparse`);
      toastSuccess("Re-parse started", "AI extraction will refresh shortly.");
      await invalidate();
    } catch (err) {
      toastApiError(err, "Couldn't re-parse");
    } finally {
      setBusyAction(null);
    }
  }

  async function download(resume: ResumeRow) {
    setBusyAction({ id: resume.id, action: "download" });
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const token = getAccessToken();
      const res = await fetch(`${apiUrl}/api/v1/resumes/${resume.id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const err = new Error(`Download failed (${res.status})`) as Error & {
          body?: unknown;
        };
        err.body = body;
        throw err;
      }
      const body = (await res.json()) as { data: { signedUrl: string } };
      window.open(body.data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      toastApiError(err, "Couldn't download");
    } finally {
      setBusyAction(null);
    }
  }

  async function requestDelete(resume: ResumeRow) {
    const ok = await confirm({
      title: "Delete this resume?",
      description: `${resume.filename}${
        resume.isDefault
          ? " is your default resume. You'll need to set another as default."
          : ""
      } This action can't be undone.`,
      confirmLabel: "Delete resume",
      variant: "destructive",
    });
    if (!ok) return;
    setBusyAction({ id: resume.id, action: "delete" });
    try {
      await apiCall(`/api/v1/resumes/${resume.id}`, { method: "DELETE" });
      toastSuccess("Resume deleted");
      if (selectedId === resume.id) setSelectedId(null);
      await invalidate();
    } catch (err) {
      toastApiError(err, "Couldn't delete");
    } finally {
      setBusyAction(null);
    }
  }

  function onUploaded(row: ResumeRow) {
    justUploadedIdRef.current = row.id;
    void invalidate();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          Resume
        </h1>
        <p className="mt-1 text-sm text-[var(--color-body)]">
          {isLoading
            ? "Loading…"
            : resumes.length === 0
              ? "Upload a resume so we can match you to roles."
              : `${resumes.length} resume${
                  resumes.length === 1 ? "" : "s"
                } on file. The default is used when you apply.`}
        </p>
      </header>

      {isError ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 text-sm text-[var(--color-status-danger)]">
          Failed to load resumes.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          {/* Left rail: list + upload */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            <UploadDropzone onUploaded={onUploaded} />
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Your resumes
                </h2>
                <span className="font-mono text-[11px] text-[var(--color-muted)]">
                  {resumes.length}
                </span>
              </div>
              {isLoading ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)]"
                    />
                  ))}
                </div>
              ) : resumes.length === 0 ? (
                <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4 text-center text-xs text-[var(--color-muted)]">
                  Uploaded resumes will appear here.
                </div>
              ) : (
                <ul className="space-y-2">
                  {resumes.map((r) => (
                    <ResumeListItem
                      key={r.id}
                      resume={r}
                      selected={r.id === selectedId}
                      onSelect={() => setSelectedId(r.id)}
                      onSetDefault={() => void setDefault(r)}
                      onDelete={() => void requestDelete(r)}
                      onReparse={() => void reparse(r)}
                      onDownload={() => void download(r)}
                      busyAction={
                        busyAction?.id === r.id ? busyAction.action : null
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          </aside>

          {/* Right pane: preview */}
          <section className="min-w-0">
            {selected ? (
              <PreviewPane resume={selected} />
            ) : (
              <div className="flex h-full min-h-[520px] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
                <FileText className="h-8 w-8 text-[var(--color-muted)]" />
                <h3 className="mt-4 text-base font-semibold text-[var(--color-ink)]">
                  No resume selected
                </h3>
                <p className="mt-1 max-w-sm text-sm text-[var(--color-body)]">
                  Upload a PDF or DOCX on the left to see a live preview and the
                  AI-extracted fields here.
                </p>
              </div>
            )}
          </section>
        </div>
      )}

    </div>
  );
}
