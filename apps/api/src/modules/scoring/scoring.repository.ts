import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import {
  profileScoresTable,
  matchScoresTable,
  evidenceExcerptsTable,
  scoringConfigTable,
  type ProfileScore,
  type NewProfileScore,
  type MatchScore,
  type NewMatchScore,
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

  async findMatchScoreByApplicationId(applicationId: string): Promise<MatchScore | null> {
    const [row] = await this.db
      .select()
      .from(matchScoresTable)
      .where(eq(matchScoresTable.applicationId, applicationId))
      .limit(1);
    return row ?? null;
  }
}
