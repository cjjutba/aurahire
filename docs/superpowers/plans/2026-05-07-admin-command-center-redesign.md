# Admin Command Center Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the admin Command Center page (`/admin`) to match the visual + interaction patterns of the candidate and recruiter portal dashboards, and humanize audit-action codes (e.g., `score.match.preview.computed` → "Job match preview computed") across all three admin surfaces that surface them.

**Architecture:** Frontend-only. A new pure utility (`humanizeAuditAction`) maps the `AUDIT_ACTIONS` vocabulary to plain-English labels and is consumed by the dashboard widget, the audit table, and the audit detail sheet. The dashboard client is restructured into two grouped KPI rows (3-up each) plus a snapshot row of three widgets, all using the same `KpiTile`-style outer card and section-header pattern already established in `apps/web/app/(candidate)/candidate/_dashboard-client.tsx`. **No backend, shared, or db package changes.**

**Tech Stack:** Next.js 16 App Router (`apps/web`), React 19, TypeScript strict, Tailwind v4 with CSS-variable design tokens, Lucide icons, TanStack Query, vitest for unit tests.

**Spec:** `docs/superpowers/specs/2026-05-07-admin-command-center-redesign-design.md`

**Hard rules (from `CLAUDE.md`):**
- The implementer must NOT run any dev server, migration, or deploy command. Type-check and lint only.
- The user runs `pnpm dev` themselves and verifies visual results in the browser.
- Commits are written into the plan as steps, but agents must defer to CLAUDE.md's commit policy in the executing session — the user authorizes commits explicitly.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `apps/web/lib/audit/humanize-action.ts` | **Create** | Pure function that maps a known audit action code to a plain-English label, with a Title-Cased fallback for unknown codes. |
| `apps/web/lib/audit/humanize-action.test.ts` | **Create** | vitest unit tests covering the lookup map, the fallback, and edge cases. |
| `apps/web/app/(admin)/admin/_dashboard-client.tsx` | **Modify** | Replace the whole client with the new KpiTile + 2 KPI rows + 3 widgets layout. |
| `apps/web/app/(admin)/admin/loading.tsx` | **Modify** | Adapt skeleton heights/grids to the new layout shape. |
| `apps/web/app/(admin)/admin/audit/_audit-table-client.tsx` | **Modify** | Replace the `<code>` action cell with the humanized label; raw code stays as `title=`. |
| `apps/web/app/(admin)/admin/audit/_audit-detail-sheet-client.tsx` | **Modify** | Sheet title becomes the humanized label; raw code shown as a muted mono sub-line. |

Each task below produces self-contained, type-clean changes.

---

## Task 1: Create the audit-action humanizer utility (TDD)

**Files:**
- Create: `apps/web/lib/audit/humanize-action.ts`
- Test: `apps/web/lib/audit/humanize-action.test.ts`

The utility is a pure function — perfect for vitest. The codebase has precedent for co-located tests next to source (e.g., `apps/web/components/onboarding/resume-preview/find-text-spans.test.ts`). Test runner is `vitest`, invoked via `pnpm --filter @aurahire/web test`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/audit/humanize-action.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { humanizeAuditAction } from "./humanize-action";

describe("humanizeAuditAction", () => {
  describe("known action codes", () => {
    it("humanizes score.match.preview.computed", () => {
      expect(humanizeAuditAction("score.match.preview.computed")).toBe(
        "Job match preview computed",
      );
    });

    it("humanizes resume.parsed", () => {
      expect(humanizeAuditAction("resume.parsed")).toBe("Resume parsed");
    });

    it("humanizes user.registered.candidate", () => {
      expect(humanizeAuditAction("user.registered.candidate")).toBe(
        "Candidate joined",
      );
    });

    it("humanizes user.registered.recruiter", () => {
      expect(humanizeAuditAction("user.registered.recruiter")).toBe(
        "Recruiter joined",
      );
    });

    it("humanizes user.email_verified", () => {
      expect(humanizeAuditAction("user.email_verified")).toBe("Email verified");
    });

    it("humanizes application.created", () => {
      expect(humanizeAuditAction("application.created")).toBe(
        "Application submitted",
      );
    });

    it("humanizes job.archived_by_cron", () => {
      expect(humanizeAuditAction("job.archived_by_cron")).toBe(
        "Job archived (deadline passed)",
      );
    });

    it("humanizes scoring_config.updated", () => {
      expect(humanizeAuditAction("scoring_config.updated")).toBe(
        "Scoring weights updated",
      );
    });

    it("humanizes bias_flag.overridden", () => {
      expect(humanizeAuditAction("bias_flag.overridden")).toBe(
        "Bias flag overridden",
      );
    });

    it("humanizes interview.scheduled", () => {
      expect(humanizeAuditAction("interview.scheduled")).toBe(
        "Interview scheduled",
      );
    });

    it("humanizes offer.accepted", () => {
      expect(humanizeAuditAction("offer.accepted")).toBe("Offer accepted");
    });

    it("humanizes cron.expire_offers.executed", () => {
      expect(humanizeAuditAction("cron.expire_offers.executed")).toBe(
        "Offer expiry cron ran",
      );
    });

    it("humanizes user.password_reset_forced", () => {
      expect(humanizeAuditAction("user.password_reset_forced")).toBe(
        "Password reset (forced by admin)",
      );
    });
  });

  describe("fallback for unknown codes", () => {
    it("title-cases dotted segments", () => {
      expect(humanizeAuditAction("foo.bar")).toBe("Foo Bar");
    });

    it("title-cases underscored tokens", () => {
      expect(humanizeAuditAction("foo.bar_baz")).toBe("Foo Bar Baz");
    });

    it("handles multi-segment unknowns", () => {
      expect(humanizeAuditAction("future.new_event.happened")).toBe(
        "Future New Event Happened",
      );
    });

    it("returns the input unchanged when it has no separators", () => {
      expect(humanizeAuditAction("Plain")).toBe("Plain");
    });
  });

  describe("edge cases", () => {
    it("returns an em-dash for an empty string", () => {
      expect(humanizeAuditAction("")).toBe("—");
    });

    it("trims whitespace before processing", () => {
      expect(humanizeAuditAction("  resume.parsed  ")).toBe("Resume parsed");
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @aurahire/web test apps/web/lib/audit/humanize-action.test.ts`

Expected: FAIL — `Cannot find module './humanize-action'` or equivalent.

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/audit/humanize-action.ts`:

```ts
/**
 * Plain-English labels for known audit action codes. The backend writes
 * canonical dotted strings (see apps/api/src/audit/audit.types.ts); this
 * map renders them for human consumption in the admin portal.
 *
 * Keep this map in sync with AUDIT_ACTIONS in the API. If a backend code
 * appears that isn't in this map, the fallback formatter still renders
 * it cleanly (Title Cased Words) — losing nuance but never readability.
 */
const KNOWN_LABELS: Record<string, string> = {
  // Identity & accounts
  "user.registered.candidate": "Candidate joined",
  "user.registered.recruiter": "Recruiter joined",
  "user.login": "User signed in",
  "user.logout": "User signed out",
  "user.password_reset_requested": "Password reset requested",
  "user.password_reset": "Password reset",
  "user.password_reset_forced": "Password reset (forced by admin)",
  "user.email_verified": "Email verified",
  "user.suspended": "User suspended",
  "user.reactivated": "User reactivated",
  "user.deleted": "User deleted",
  "user.deleted_unverified_cleanup": "Unverified account cleaned up",
  "user.role_changed": "User role changed",

  // Onboarding
  "user.onboarding.personal_updated": "Personal info updated",
  "user.onboarding.preferences_updated": "Preferences updated",
  "user.onboarding.about_updated": "About updated",
  "user.onboarding.company_updated": "Company info updated",
  "user.onboarding.completed": "Onboarding completed",

  // Resumes
  "resume.uploaded": "Resume uploaded",
  "resume.parsed": "Resume parsed",
  "resume.parse_failed": "Resume parsing failed",
  "resume.reparsed": "Resume re-parsed",
  "resume.reparse_failed": "Resume re-parsing failed",
  "resume.set_default": "Default resume changed",
  "resume.deleted": "Resume deleted",

  // Jobs
  "job.created": "Job created",
  "job.updated": "Job updated",
  "job.published": "Job published",
  "job.archived": "Job archived",
  "job.archived_by_admin": "Job archived by admin",
  "job.archived_by_cron": "Job archived (deadline passed)",
  "job.bias_check_run": "Bias check run on job",

  // Applications
  "application.created": "Application submitted",
  "application.shortlisted": "Candidate shortlisted",
  "application.unshortlisted": "Candidate removed from shortlist",
  "application.status_changed": "Application status changed",
  "application.notes_updated": "Application notes updated",
  "application.withdrawn": "Application withdrawn",
  "application.email_sent": "Candidate emailed",

  // Interviews
  "interview.scheduled": "Interview scheduled",
  "interview.feedback_updated": "Interview feedback updated",
  "interview.status_changed": "Interview status changed",

  // Offers
  "offer.sent": "Offer sent",
  "offer.accepted": "Offer accepted",
  "offer.declined": "Offer declined",
  "offer.withdrawn": "Offer withdrawn",
  "offer.expired": "Offer expired",

  // Scoring & AI
  "scoring_config.updated": "Scoring weights updated",
  "score.profile.computed": "Profile score computed",
  "score.match.computed": "Match score computed",
  "score.match.recomputed": "Match score recomputed",
  "score.match.preview.computed": "Job match preview computed",
  "queue.rescore_batch.enqueued": "Rescore batch enqueued",
  "bias_flag.overridden": "Bias flag overridden",

  // Companies & members
  "company.created": "Company created",
  "company.updated": "Company updated",
  "company.deleted": "Company deleted",
  "company.active_switched": "Active company switched",
  "company_member.invited": "Member invited",
  "company_member.invitation_resent": "Member invitation resent",
  "company_member.invitation_revoked": "Member invitation revoked",
  "company_member.invitation_accepted": "Member invitation accepted",
  "company_member.invitation_declined": "Member invitation declined",
  "company_member.role_changed": "Member role changed",
  "company_member.removed": "Member removed",
  "company_member.left": "Member left",
  "company_member.ownership_transferred": "Ownership transferred",

  // Notifications
  "notifications.marked_all_read": "Notifications marked as read",
  "notification_preference.updated": "Notification preference updated",
  "notification_preferences.reset": "Notification preferences reset",
  "notifications.digest_email_batch_run": "Notification digest sent",
  "notifications.retention_run": "Notification cleanup ran",

  // Cron / system
  "cron.expire_offers.executed": "Offer expiry cron ran",
  "cron.archive_past_deadline_jobs.executed": "Job archive cron ran",
  "cron.cleanup_unverified_accounts.executed": "Unverified account cleanup ran",
  "cron.interview_reminder.executed": "Interview reminder cron ran",
  "cron.offer_expiry_reminder.executed": "Offer expiry reminder cron ran",
  "cron.interview_feedback_due.executed": "Interview feedback reminder cron ran",
  "system.ai_scoring_failure_notified": "AI scoring failure notified",
};

function titleCaseFallback(action: string): string {
  return action
    .split(".")
    .flatMap((segment) => segment.split("_"))
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Returns a plain-English label for a known audit action code.
 * Falls back to Title Cased Words for unknown codes (forward compatibility).
 * Returns "—" for empty input.
 */
export function humanizeAuditAction(action: string): string {
  const trimmed = action.trim();
  if (trimmed.length === 0) return "—";
  const known = KNOWN_LABELS[trimmed];
  if (known) return known;
  return titleCaseFallback(trimmed);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @aurahire/web test apps/web/lib/audit/humanize-action.test.ts`

Expected: PASS — all describe/it blocks green.

- [ ] **Step 5: Type-check**

Run: `pnpm --filter @aurahire/web tsc --noEmit`

Expected: no errors related to the new files.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/audit/humanize-action.ts apps/web/lib/audit/humanize-action.test.ts
git commit -m "feat(web): add audit action humanizer utility

Maps the canonical AUDIT_ACTIONS vocabulary (apps/api/src/audit/audit.types.ts)
to plain-English labels for the admin portal. Includes a Title-Cased fallback
for forward compatibility with new backend actions.

Spec: docs/superpowers/specs/2026-05-07-admin-command-center-redesign-design.md"
```

---

## Task 2: Redesign the Command Center dashboard client

**Files:**
- Modify: `apps/web/app/(admin)/admin/_dashboard-client.tsx` (full rewrite of file body)

This task replaces the existing `DashboardClient`, `ScoreDistributionWidget`, `BiasFlagsWidget`, and `RecentAuditWidget` with the new layout. The existing imports for `useAdminStatsControllerOverviewV1`, `useRealtimeChannel`, `getAccessToken`, and `Skeleton` are reused; the existing `useAuthTokenReady` and `relativeTime` helpers are preserved verbatim.

The file imports the new `humanizeAuditAction` utility from Task 1 and the `AuditDetailSheetClient` already used by the audit table (so audit rows can be clicked through to detail).

- [ ] **Step 1: Read the current dashboard client to confirm the imports and helpers being preserved**

Run: `cat apps/web/app/(admin)/admin/_dashboard-client.tsx | head -45`

Expected: confirms the file currently imports `useAdminStatsControllerOverviewV1`, `getAccessToken`, `useRealtimeChannel`, `RealtimeEvent`, `Skeleton`, and defines `useAuthTokenReady` + `relativeTime` helpers. These must be preserved.

- [ ] **Step 2: Replace the file with the new implementation**

Overwrite `apps/web/app/(admin)/admin/_dashboard-client.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Briefcase,
  Cpu,
  Inbox,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  getAccessToken,
  useAdminStatsControllerOverviewV1,
  type AdminStatsOverviewDto,
  type AdminStatsOverviewEnvelopeDto,
} from "@aurahire/shared";

import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { RealtimeEvent } from "@/lib/realtime";
import { humanizeAuditAction } from "@/lib/audit/humanize-action";

type Stats = AdminStatsOverviewDto;

/**
 * Defer the React Query call until AuthTokenProvider has populated the module-
 * level access token. Without this gate, the first fetch can race ahead of the
 * Supabase session read and 401 on cold loads.
 */
function useAuthTokenReady(): boolean {
  const [ready, setReady] = useState(() => getAccessToken() !== null);
  useEffect(() => {
    if (ready) return;
    const interval = window.setInterval(() => {
      if (getAccessToken() !== null) {
        setReady(true);
        window.clearInterval(interval);
      }
    }, 50);
    return () => window.clearInterval(interval);
  }, [ready]);
  return ready;
}

const BAND_COLOR: Record<string, string> = {
  strong: "var(--color-score-high)",
  partial: "var(--color-score-mid)",
  limited: "var(--color-score-low)",
};

const ACTOR_BG: Record<string, string> = {
  user: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
  ai: "bg-[var(--color-score-mid-soft)] text-[var(--color-score-mid)]",
  system: "bg-[var(--color-surface-strong)] text-[var(--color-muted)]",
};

const ACTOR_ICON: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  user: Users,
  ai: Sparkles,
  system: Cpu,
};

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return new Date(iso).toLocaleString();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function SectionHeader({
  icon: Icon,
  label,
  trailing,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon
          className="h-3.5 w-3.5 text-[var(--color-muted)]"
          aria-hidden
        />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </span>
      </div>
      {trailing}
    </div>
  );
}

function KpiTile({
  label,
  value,
  icon: Icon,
  description,
  tone = "neutral",
  loading = false,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  tone?: "neutral" | "score";
  loading?: boolean;
}) {
  let valueClass = "text-[var(--color-ink)]";
  if (tone === "score") {
    if (value === 0) valueClass = "text-[var(--color-muted)]";
    else if (value < 40) valueClass = "text-[var(--color-score-low)]";
    else if (value < 70) valueClass = "text-[var(--color-score-mid)]";
    else valueClass = "text-[var(--color-score-high)]";
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </span>
        <Icon className="h-4 w-4 text-[var(--color-muted)]" aria-hidden />
      </div>
      <div
        className={`mt-3 font-mono text-3xl font-medium ${
          loading ? "text-[var(--color-muted)]" : valueClass
        }`}
      >
        {loading ? "—" : value}
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        {description}
      </div>
    </div>
  );
}

const FOOTPRINT_TILES: Array<{
  key: keyof Stats;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "neutral" | "score";
}> = [
  {
    key: "totalUsers",
    label: "Total Users",
    description: "All-time accounts",
    icon: Users,
    tone: "neutral",
  },
  {
    key: "activeJobs",
    label: "Active Jobs",
    description: "Currently published",
    icon: Briefcase,
    tone: "neutral",
  },
  {
    key: "applicationsThisWeek",
    label: "Apps This Week",
    description: "Submitted in last 7 days",
    icon: TrendingUp,
    tone: "neutral",
  },
];

const QUALITY_TILES: Array<{
  key: keyof Stats;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "neutral" | "score";
}> = [
  {
    key: "applicationsToday",
    label: "Apps Today",
    description: "Submitted today",
    icon: Inbox,
    tone: "neutral",
  },
  {
    key: "avgProfileScore",
    label: "Avg Profile Score",
    description: "Across all candidates",
    icon: Sparkles,
    tone: "score",
  },
  {
    key: "avgMatchScore",
    label: "Avg Match Score",
    description: "Last 30 days",
    icon: BarChart3,
    tone: "score",
  },
];

export function DashboardClient() {
  const tokenReady = useAuthTokenReady();
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useAdminStatsControllerOverviewV1({
    query: {
      staleTime: 60_000,
      enabled: tokenReady,
    },
  });

  useRealtimeChannel(RealtimeEvent.AuditEntry, () => {
    queryClient.invalidateQueries({
      queryKey: ["/api/v1/admin/stats/overview"],
    });
  });

  useRealtimeChannel(RealtimeEvent.BiasFlagCreated, () => {
    queryClient.invalidateQueries({
      queryKey: ["/api/v1/admin/stats/overview"],
    });
  });

  if (isError) {
    return (
      <div className="text-[var(--color-status-danger)]">
        Failed to load admin overview.
      </div>
    );
  }

  // Custom fetcher returns the unwrapped JSON body, but orval types it as a
  // {data, status, headers} response wrapper. The runtime body is the envelope.
  const envelope = data as unknown as AdminStatsOverviewEnvelopeDto | undefined;
  const stats = envelope?.data;

  return (
    <div className="space-y-8">
      <section>
        <SectionHeader icon={BarChart3} label="Footprint" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FOOTPRINT_TILES.map((tile) => {
            const block = stats?.[tile.key] as
              | { label: string; value: number }
              | undefined;
            return (
              <KpiTile
                key={tile.key as string}
                label={block?.label ?? tile.label}
                value={block?.value ?? 0}
                icon={tile.icon}
                description={tile.description}
                tone={tile.tone}
                loading={isPending || !block}
              />
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeader icon={Sparkles} label="Today & AI Quality" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {QUALITY_TILES.map((tile) => {
            const block = stats?.[tile.key] as
              | { label: string; value: number }
              | undefined;
            return (
              <KpiTile
                key={tile.key as string}
                label={block?.label ?? tile.label}
                value={block?.value ?? 0}
                icon={tile.icon}
                description={tile.description}
                tone={tile.tone}
                loading={isPending || !block}
              />
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeader icon={Activity} label="Snapshot" />
        <div className="grid gap-4 lg:grid-cols-3">
          <ScoreDistributionWidget stats={stats} isPending={isPending} />
          <BiasFlagsWidget stats={stats} isPending={isPending} />
          <RecentAuditWidget stats={stats} isPending={isPending} />
        </div>
      </section>
    </div>
  );
}

function ScoreDistributionWidget({
  stats,
  isPending,
}: {
  stats: Stats | undefined;
  isPending: boolean;
}) {
  const histogram = stats?.scoreBandHistogram ?? [];
  const totalScores = histogram.reduce((sum, e) => sum + e.count, 0);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <div className="flex items-center gap-2">
        <BarChart3
          className="h-3.5 w-3.5 text-[var(--color-muted)]"
          aria-hidden
        />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Score Distribution (Last 30 Days)
        </h3>
      </div>
      {isPending ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      ) : (
        <>
          <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">
            {totalScores} total
          </p>
          {totalScores === 0 ? (
            <p className="mt-6 text-sm text-[var(--color-body)]">
              No match scores yet.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {histogram.map((entry) => {
                const pct = Math.round((entry.count / totalScores) * 100);
                return (
                  <div key={entry.band}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-[var(--color-body)]">
                        {entry.band}
                      </span>
                      <span className="font-mono text-[var(--color-muted)]">
                        {entry.count} · {pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)]">
                      <div
                        className="h-2 rounded-[var(--radius-pill)]"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: BAND_COLOR[entry.band],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BiasFlagsWidget({
  stats,
  isPending,
}: {
  stats: Stats | undefined;
  isPending: boolean;
}) {
  const flags = stats?.biasFlagsThisWeek ?? [];
  const totalFlags = flags.reduce((sum, e) => sum + e.count, 0);
  const max = Math.max(0, ...flags.map((f) => f.count));

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <div className="flex items-center gap-2">
        <AlertTriangle
          className="h-3.5 w-3.5 text-[var(--color-muted)]"
          aria-hidden
        />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Bias Flags This Week
        </h3>
      </div>
      {isPending ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      ) : (
        <>
          <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">
            {totalFlags} total
          </p>
          {totalFlags === 0 ? (
            <p className="mt-6 text-sm text-[var(--color-body)]">
              No flags this week.
            </p>
          ) : (
            <ul className="mt-6 space-y-3">
              {flags.map((entry) => {
                const widthPct =
                  max === 0
                    ? 0
                    : Math.max(2, Math.round((entry.count / max) * 100));
                return (
                  <li key={entry.category}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-[var(--color-body)]">
                        {entry.category}
                      </span>
                      <span className="font-mono text-[var(--color-ink)]">
                        {entry.count}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)]">
                      <div
                        className="h-2 rounded-[var(--radius-pill)]"
                        style={{
                          width: entry.count === 0 ? "0%" : `${widthPct}%`,
                          backgroundColor: "var(--color-status-warning)",
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function RecentAuditWidget({
  stats,
  isPending,
}: {
  stats: Stats | undefined;
  isPending: boolean;
}) {
  const events = stats?.recentAuditEvents ?? [];

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity
            className="h-3.5 w-3.5 text-[var(--color-muted)]"
            aria-hidden
          />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Recent Audit Events
          </h3>
        </div>
        <Link
          href="/admin/audit"
          className="text-xs font-medium text-[var(--color-primary)] hover:underline"
        >
          View all →
        </Link>
      </div>
      {isPending ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--color-body)]">
          No recent activity.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--color-hairline-soft)]">
          {events.map((e, i) => {
            const Icon = ACTOR_ICON[e.actorType] ?? Activity;
            const actorClass =
              ACTOR_BG[e.actorType] ??
              "bg-[var(--color-surface-strong)] text-[var(--color-muted)]";
            const label = humanizeAuditAction(e.action);
            return (
              <li
                key={i}
                className="flex items-center gap-3 py-2.5"
                title={e.action}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-full)] ${actorClass}`}
                  aria-hidden
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[var(--color-ink)]">
                    {label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
                    {relativeTime(e.createdAt)}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 rounded-[var(--radius-pill)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${actorClass}`}
                >
                  {e.actorType}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

> **Why no click-to-detail on dashboard rows in this slice:** the `RecentAuditEntryDto` returned by `/admin/stats/overview` does not include the audit entry `id` (see `apps/api/src/modules/admin/dto/admin-stats-response.dto.ts`). Wiring click-through would require either widening the DTO (backend change — out of scope per spec) or refetching the latest entries by `(action, createdAt)` (brittle). The spec already commits to "View all →" as the navigation affordance, which gives admins one click to the full audit table where rows ARE clickable.

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @aurahire/web tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Lint**

Run: `pnpm --filter @aurahire/web lint`

Expected: no errors related to `_dashboard-client.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(admin)/admin/_dashboard-client.tsx
git commit -m "feat(admin): redesign Command Center to match candidate/recruiter pattern

- KPI tiles in 2 grouped 3-up rows (Footprint / Today & AI Quality) with
  icons, descriptions, and score-tone coloring.
- Section headers use the small-icon + uppercase-tracking pattern.
- Bias Flags widget gets the bar treatment so the snapshot row reads
  consistently with Score Distribution.
- Recent Audit Events row now shows actor-icon plate + plain-English
  label (via humanizeAuditAction) + actor pill + relative time. Raw
  action code preserved as title= for engineering inspection. Adds
  View all → link to /admin/audit since the overview endpoint
  doesn't carry entry ids for inline drill-through.

Spec: docs/superpowers/specs/2026-05-07-admin-command-center-redesign-design.md"
```

---

## Task 3: Adapt the Command Center loading skeleton

**Files:**
- Modify: `apps/web/app/(admin)/admin/loading.tsx`

The skeleton must mirror the new layout: title block, two 3-up KPI rows, one 3-up snapshot row.

- [ ] **Step 1: Replace the file**

Overwrite `apps/web/app/(admin)/admin/loading.tsx` with:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-96" />
      </div>
      <div className="space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-[var(--radius-lg)]" />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-3 w-32" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-[var(--radius-lg)]" />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-3 w-20" />
          <div className="grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-[var(--radius-lg)]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @aurahire/web tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(admin)/admin/loading.tsx
git commit -m "chore(admin): adapt Command Center skeleton to new 2x3 + snapshot layout"
```

---

## Task 4: Humanize the audit table action cell

**Files:**
- Modify: `apps/web/app/(admin)/admin/audit/_audit-table-client.tsx`

The action cell currently renders the raw code inside a monospace `<code>` pill. Replace with the humanized label, retaining the raw code as the cell's `title=` attribute for engineering grepping.

- [ ] **Step 1: Add the humanizer import at the top of the file**

Edit `apps/web/app/(admin)/admin/audit/_audit-table-client.tsx`. After the existing imports (line 13: `import { AuditDetailSheetClient } from "./_audit-detail-sheet-client";`) add:

```tsx
import { humanizeAuditAction } from "@/lib/audit/humanize-action";
```

- [ ] **Step 2: Replace the action cell**

Find this block (around lines 85-89):

```tsx
                <td className="p-3">
                  <code className="rounded-[var(--radius-xs)] bg-[var(--color-surface-soft)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-ink)]">
                    {r.action}
                  </code>
                </td>
```

Replace with:

```tsx
                <td className="p-3">
                  <span
                    className="text-sm text-[var(--color-ink)]"
                    title={r.action}
                  >
                    {humanizeAuditAction(r.action)}
                  </span>
                </td>
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @aurahire/web tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(admin)/admin/audit/_audit-table-client.tsx
git commit -m "feat(admin): humanize audit action cell in audit table

Plain-English labels via humanizeAuditAction; raw code preserved as
title= for engineering grep."
```

---

## Task 5: Humanize the audit detail sheet header

**Files:**
- Modify: `apps/web/app/(admin)/admin/audit/_audit-detail-sheet-client.tsx`

The sheet currently shows the raw action code as the title. Replace with the humanized label, and add the raw code as a muted monospace sub-line directly beneath so engineers can still match log lines.

- [ ] **Step 1: Add the humanizer import**

Edit `apps/web/app/(admin)/admin/audit/_audit-detail-sheet-client.tsx`. After the existing import block (line 12: `import { createSupabaseBrowserClient } from "@/lib/auth/client";`) add:

```tsx
import { humanizeAuditAction } from "@/lib/audit/humanize-action";
```

- [ ] **Step 2: Replace the SheetHeader**

Find this block (lines 90-92):

```tsx
        <SheetHeader>
          <SheetTitle>{detail?.action ?? "Loading…"}</SheetTitle>
        </SheetHeader>
```

Replace with:

```tsx
        <SheetHeader>
          <SheetTitle>
            {detail ? humanizeAuditAction(detail.action) : "Loading…"}
          </SheetTitle>
          {detail && (
            <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">
              {detail.action}
            </p>
          )}
        </SheetHeader>
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @aurahire/web tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(admin)/admin/audit/_audit-detail-sheet-client.tsx
git commit -m "feat(admin): humanize audit detail sheet title

Sheet title shows the plain-English label; raw action code surfaces as a
muted mono sub-line so engineers can still grep server logs."
```

---

## Task 6: Final verification (manual)

**Files:** none (visual QA only)

Type checks and lints have passed at each step. The user runs the dev server (`pnpm dev`) and visually verifies the redesign in the browser. Agents must not start the dev server.

- [ ] **Step 1: Run the test suite**

Run: `pnpm --filter @aurahire/web test`

Expected: all tests pass, including the new `humanize-action.test.ts`.

- [ ] **Step 2: Run the type-check across the web workspace**

Run: `pnpm --filter @aurahire/web tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Run the lint across the web workspace**

Run: `pnpm --filter @aurahire/web lint`

Expected: no errors.

- [ ] **Step 4: Hand off to the user for visual QA**

Tell the user (verbatim or close to it):

> Ready for browser verification. Please run `pnpm dev` from the repo root and check:
>
> 1. **/admin** — Command Center should show two grouped 3-up KPI rows (Footprint, Today & AI Quality) with icons + descriptions, then a 3-up snapshot row. Bias Flags should now have horizontal bars matching Score Distribution. Recent Audit Events should show plain-English labels (e.g. "Job match preview computed" instead of `score.match.preview.computed`), with actor-icon plates on the left, actor pill on the right, and a "View all →" link going to /admin/audit.
> 2. **/admin/audit** — table Action column should show plain-English labels; hovering reveals the raw code in the tooltip.
> 3. **/admin/audit → click any row** — sheet title should be the plain-English label; the raw action code should appear as a small muted mono sub-line below the title.
>
> Confirm at narrow viewports (mobile + tablet) that the KPI rows collapse from 3-up → 2-up → 1-up, and the snapshot row stacks to 1-up. Confirm no console warnings about missing keys, hydration mismatches, or duplicate ids.

---

## Self-Review

**1. Spec coverage**

Walking each spec section:

- §4.1 Page header — unchanged. (`page.tsx` already has the right copy; not touched in this plan.) ✓
- §4.2 KPI grid — Task 2 ✓
- §4.3.1 Score Distribution — Task 2 (widget retained, section header upgraded) ✓
- §4.3.2 Bias Flags (bar pattern) — Task 2 ✓
- §4.3.3 Recent Audit Events (humanized + actor icon + view-all link) — Task 2 ✓
- §4.4 Loading skeleton — Task 3 ✓
- §5.1–5.5 Humanizer (utility + dashboard + table + sheet) — Tasks 1, 2, 4, 5 ✓
- §6 Affected files — all five files appear in tasks ✓
- §7 Realtime/caching — preserved verbatim in Task 2 ✓
- §8 Accessibility — `title=` for raw codes, semantic headings preserved, color-not-only signaling preserved ✓
- §9 Implementation order — matches plan order ✓
- §10 Risks — addressed inline (truncate + min-w-0 in audit row, fallback for unknown codes, intentional `0 → muted` tone) ✓
- §11 Out of scope — no plan task touches `apps/api/`, `packages/shared/`, or `packages/db/` ✓

One spec divergence (intentional & documented inline): **§4.3.3 says "Whole row is clickable — opens the audit detail sheet."** The plan explicitly does not wire that in this slice because the `RecentAuditEntryDto` returned by `/admin/stats/overview` lacks the entry id. The "View all →" link is the documented escape hatch in §4.3.3 itself. If the user objects, the fix is a separate slice that widens the DTO — I'll flag this when handing off so it's a conscious decision.

**2. Placeholder scan** — no "TBD", "TODO", or "implement appropriate X" placeholders. Every step has the actual code or command. ✓

**3. Type consistency** — `KpiTile` props (`label, value, icon, description, tone, loading`) are used identically in `FOOTPRINT_TILES` / `QUALITY_TILES`. `humanizeAuditAction` signature `(action: string) => string` is identical at all four call sites. `RecentAuditEntryDto` shape (`action, actorType, entityType, createdAt`) matches what's in `apps/api/src/modules/admin/dto/admin-stats-response.dto.ts`. ✓

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-07-admin-command-center-redesign.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints

**Which approach?**
