import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  applicationsTable,
  profileScoresTable,
  matchScoresTable,
  matchScorePreviewsTable,
  evidenceExcerptsTable,
  scoringConfigTable,
  type ProfileScore,
  type NewProfileScore,
  type MatchScore,
  type NewMatchScore,
  type MatchScorePreview,
  type NewMatchScorePreview,
  type EvidenceExcerpt,
  type NewEvidenceExcerpt,
  type ScoringConfig,
} from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";

@Injectable()
export class ScoringRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async getActiveConfig(): Promise<ScoringConfig | null> {
    const [row] = await this.db
      .select()
      .from(scoringConfigTable)
      .where(eq(scoringConfigTable.isActive, true))
      .limit(1);
    return row ?? null;
  }

  async insertProfileScore(
    profileScoreData: NewProfileScore,
    evidenceData: Array<Omit<NewEvidenceExcerpt, "scoreId" | "scoreType">>,
  ): Promise<{ profileScore: ProfileScore; evidence: EvidenceExcerpt[] }> {
    return await this.db.transaction(async (tx) => {
      const [profileScore] = await tx
        .insert(profileScoresTable)
        .values(profileScoreData)
        .returning();
      if (!profileScore) throw new Error("Profile score insert failed");

      let evidence: EvidenceExcerpt[] = [];
      if (evidenceData.length > 0) {
        evidence = await tx
          .insert(evidenceExcerptsTable)
          .values(
            evidenceData.map((e) => ({
              ...e,
              scoreType: "profile" as const,
              scoreId: profileScore.id,
            })),
          )
          .returning();
      }

      return { profileScore, evidence };
    });
  }

  async findMostRecentProfileScore(
    candidateId: string,
  ): Promise<ProfileScore | null> {
    const [row] = await this.db
      .select()
      .from(profileScoresTable)
      .where(eq(profileScoresTable.candidateId, candidateId))
      .orderBy(desc(profileScoresTable.createdAt))
      .limit(1);
    return row ?? null;
  }

  /**
   * True when the candidate has at least one profile_scores row that is
   * still considered current (`stale_at IS NULL`). Used by the portal-entry
   * backfill guard (Task 12) to short-circuit when a candidate already has
   * a fresh score.
   */
  async hasCurrentProfileScore(candidateId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: profileScoresTable.id })
      .from(profileScoresTable)
      .where(
        and(
          eq(profileScoresTable.candidateId, candidateId),
          isNull(profileScoresTable.staleAt),
        ),
      )
      .limit(1);
    return !!row;
  }

  async findEvidenceByScoreId(
    scoreType: "profile" | "match",
    scoreId: string,
  ): Promise<EvidenceExcerpt[]> {
    return this.db
      .select()
      .from(evidenceExcerptsTable)
      .where(
        and(
          eq(evidenceExcerptsTable.scoreType, scoreType),
          eq(evidenceExcerptsTable.scoreId, scoreId),
        ),
      );
  }

  async insertMatchScore(
    matchScoreData: NewMatchScore,
    evidenceData: Array<Omit<NewEvidenceExcerpt, "scoreId" | "scoreType">>,
  ): Promise<{ matchScore: MatchScore; evidence: EvidenceExcerpt[] }> {
    return await this.db.transaction(async (tx) => {
      const [matchScore] = await tx
        .insert(matchScoresTable)
        .values(matchScoreData)
        .returning();
      if (!matchScore) throw new Error("Match score insert failed");

      let evidence: EvidenceExcerpt[] = [];
      if (evidenceData.length > 0) {
        evidence = await tx
          .insert(evidenceExcerptsTable)
          .values(
            evidenceData.map((e) => ({
              ...e,
              scoreType: "match" as const,
              scoreId: matchScore.id,
            })),
          )
          .returning();
      }

      return { matchScore, evidence };
    });
  }

  async findMatchScoreByApplicationId(
    applicationId: string,
  ): Promise<MatchScore | null> {
    const [row] = await this.db
      .select()
      .from(matchScoresTable)
      .where(eq(matchScoresTable.applicationId, applicationId))
      .limit(1);
    return row ?? null;
  }

  // ─────────────────────────────────────────────────────────────────────
  // MATCH-SCORE PREVIEWS
  // ─────────────────────────────────────────────────────────────────────

  /** Find an existing preview for the natural key (candidate, job, resume). */
  async findMatchPreview(
    candidateId: string,
    jobId: string,
    resumeId: string,
  ): Promise<MatchScorePreview | null> {
    const [row] = await this.db
      .select()
      .from(matchScorePreviewsTable)
      .where(
        and(
          eq(matchScorePreviewsTable.candidateId, candidateId),
          eq(matchScorePreviewsTable.jobId, jobId),
          eq(matchScorePreviewsTable.resumeId, resumeId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Find the most recent preview for a (candidate, job) pair regardless of
   * resume - used when the candidate just wants to see the latest preview
   * they've computed for this job.
   */
  async findLatestMatchPreviewForJob(
    candidateId: string,
    jobId: string,
  ): Promise<MatchScorePreview | null> {
    const [row] = await this.db
      .select()
      .from(matchScorePreviewsTable)
      .where(
        and(
          eq(matchScorePreviewsTable.candidateId, candidateId),
          eq(matchScorePreviewsTable.jobId, jobId),
        ),
      )
      .orderBy(desc(matchScorePreviewsTable.createdAt))
      .limit(1);
    return row ?? null;
  }

  async insertMatchPreview(
    data: NewMatchScorePreview,
  ): Promise<MatchScorePreview> {
    const [row] = await this.db
      .insert(matchScorePreviewsTable)
      .values(data)
      .returning();
    if (!row) throw new Error("Match preview insert failed");
    return row;
  }

  /**
   * UPSERT - insert or replace a preview for the (candidate, job, resume)
   * tuple. Used when re-computing on demand for the same key.
   */
  async upsertMatchPreview(
    data: NewMatchScorePreview,
  ): Promise<MatchScorePreview> {
    const [row] = await this.db
      .insert(matchScorePreviewsTable)
      .values(data)
      .onConflictDoUpdate({
        target: [
          matchScorePreviewsTable.candidateId,
          matchScorePreviewsTable.jobId,
          matchScorePreviewsTable.resumeId,
        ],
        set: {
          overallScore: data.overallScore,
          band: data.band,
          components: data.components,
          redactedFields: data.redactedFields,
          weightsUsed: data.weightsUsed,
          promptVersion: data.promptVersion,
          modelUsed: data.modelUsed,
          rawOutput: data.rawOutput,
          latencyMs: data.latencyMs,
          source: data.source,
          createdAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error("Match preview upsert failed");
    return row;
  }

  /**
   * List a candidate's previews ordered by score (descending). Used by the
   * "Recommended for you" feed.
   *
   * LEFT JOIN applications on (candidate_id, job_id) and exclude rows where
   * the candidate already applied - recommending a job they applied to is
   * wasted real estate. Withdrawn / rejected applications still suppress the
   * recommendation (re-applying after rejection is awkward UX).
   */
  async listMatchPreviewsForCandidate(
    candidateId: string,
    limit = 25,
  ): Promise<MatchScorePreview[]> {
    const rows = await this.db
      .select({ preview: matchScorePreviewsTable })
      .from(matchScorePreviewsTable)
      .leftJoin(
        applicationsTable,
        and(
          eq(applicationsTable.jobId, matchScorePreviewsTable.jobId),
          eq(applicationsTable.candidateId, candidateId),
        ),
      )
      .where(
        and(
          eq(matchScorePreviewsTable.candidateId, candidateId),
          sql`${applicationsTable.id} IS NULL`,
        ),
      )
      .orderBy(desc(matchScorePreviewsTable.overallScore))
      .limit(limit);
    return rows.map((r) => r.preview);
  }

  /**
   * Delete previews scored against a specific resume - fired when the
   * candidate replaces their default resume so stale previews don't show
   * in their "Recommended" feed.
   */
  async deleteMatchPreviewsByResume(resumeId: string): Promise<number> {
    const result = await this.db
      .delete(matchScorePreviewsTable)
      .where(eq(matchScorePreviewsTable.resumeId, resumeId))
      .returning({ id: matchScorePreviewsTable.id });
    return result.length;
  }
}
