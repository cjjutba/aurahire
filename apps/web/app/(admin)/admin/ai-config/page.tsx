import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { ConfigEditorClient } from "./_config-editor-client";
import { ApplyToExistingClient } from "./_apply-to-existing-client";

export const metadata = { title: "AI Scoring Configuration" };

interface ConfigBody {
  data: {
    id: string;
    matchWeights: {
      skills: number;
      experience: number;
      education: number;
      cultural_fit: number;
    };
    profileWeights: {
      completeness: number;
      skill_depth: number;
      experience_clarity: number;
      education_quality: number;
    };
    bandThresholds: { strong: number; partial: number };
    biasCategoriesEnabled: string[];
    customFlaggedTerms: string[];
    piiRedactionEnabled: boolean;
    piiFieldsRedacted: string[];
    updatedBy: { id: string; fullName: string; email: string } | null;
    updatedAt: string;
  };
}

export default async function AiConfigPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/admin/scoring-config`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 404) {
      return (
        <div className="mx-auto max-w-[1280px] space-y-4">
          <div className="max-w-[840px] space-y-4">
            <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
              AI Scoring Configuration
            </h1>
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-status-warning)] bg-[var(--color-score-mid-soft)] p-4 text-sm text-[var(--color-ink)]">
              No active scoring config exists. Run the slice 2.5 pre-flight seed to
              populate the default weights.
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-[1280px]">
        <p className="text-sm text-[var(--color-status-danger)]">
          Failed to load scoring config.
        </p>
      </div>
    );
  }
  const body = (await res.json()) as ConfigBody;

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 pb-24">
      <div className="max-w-[840px] space-y-6">
        <header>
          <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
            AI Scoring Configuration
          </h1>
          <p className="mt-1 text-sm text-[var(--color-body)]">
            Tune the system-wide weights, band thresholds, and fairness controls.
            Every save is audited and takes effect immediately on subsequent scores.
          </p>
          {body.data.updatedBy && (
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Last updated by {body.data.updatedBy.fullName} (
              {body.data.updatedBy.email}) ·{" "}
              {new Date(body.data.updatedAt).toLocaleString()}
            </p>
          )}
        </header>

        <ConfigEditorClient initial={body.data} />

        <div className="my-8 border-t border-[var(--color-hairline)] pt-8">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Backfill</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Apply the currently saved weights to existing match scores. Each rescore creates a
            new match_scores row; the original scores remain for audit. Background job — you can
            leave this page; check the Audit Log for completion.
          </p>
          <div className="mt-4">
            <ApplyToExistingClient />
          </div>
        </div>
      </div>
    </div>
  );
}
