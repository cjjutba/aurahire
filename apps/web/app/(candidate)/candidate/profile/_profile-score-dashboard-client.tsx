"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";

import {
  ScoreDashboard,
  type ScoreDashboardComponent,
} from "@/components/score/score-dashboard";

import { RecomputeButtonClient } from "./_recompute-button-client";

const COMPONENT_LABELS: Record<string, string> = {
  completeness: "Completeness",
  skill_depth: "Skill Depth",
  experience_clarity: "Experience Clarity",
  education_quality: "Education Quality",
};

interface ImprovementSuggestion {
  title: string;
  description: string;
  estimatedImpact: number;
}

export interface ProfileCalibrationWarning {
  componentName: string;
  reason: "ceiling_with_thin_evidence" | "deduction_without_negative_evidence";
}

export interface ProfileScoreData {
  overallScore: number;
  band: "strong" | "partial" | "limited";
  components: ScoreDashboardComponent[];
  improvementSuggestions: ImprovementSuggestion[];
  redactedFields: string[];
  promptVersion: string;
  modelUsed: string;
  latencyMs: number;
  createdAt: string;
  calibrationWarnings?: ProfileCalibrationWarning[];
}

export function ProfileScoreDashboardClient({
  data,
}: {
  data: ProfileScoreData;
}) {
  const computedAt = useMemo(
    () =>
      new Date(data.createdAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [data.createdAt],
  );

  return (
    <ScoreDashboard
      header={
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
              Your Profile Score
            </h1>
            <p className="mt-2 text-sm text-[var(--color-body)]">
              Explainable scoring of your resume against industry signals.
            </p>
          </div>
          <RecomputeButtonClient />
        </header>
      }
      overallScore={data.overallScore}
      band={data.band}
      metaLines={
        <>
          <p>Computed {computedAt}</p>
          <p className="font-mono text-[11px]">
            {data.latencyMs}ms · {data.modelUsed}
          </p>
        </>
      }
      components={data.components}
      componentLabels={COMPONENT_LABELS}
      extraSections={
        data.improvementSuggestions.length > 0 ? (
          <section>
            <header className="mb-3 flex items-center gap-2">
              <Sparkles
                className="h-4 w-4 text-[var(--color-primary)]"
                aria-hidden
              />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                How to Improve
              </h2>
            </header>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.improvementSuggestions.map((s, i) => (
                <article
                  key={i}
                  className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4 transition hover:border-[var(--color-primary-soft)]"
                >
                  <header className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                      {s.title}
                    </h3>
                    <span className="shrink-0 rounded-[var(--radius-pill)] bg-[var(--color-primary-soft)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--color-primary)]">
                      +{s.estimatedImpact} pts
                    </span>
                  </header>
                  <p className="text-xs leading-relaxed text-[var(--color-body)]">
                    {s.description}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : undefined
      }
      calibrationNotice={null}
      fairness={{
        redactedFields: data.redactedFields,
        promptVersion: data.promptVersion,
        modelUsed: data.modelUsed,
      }}
    />
  );
}
