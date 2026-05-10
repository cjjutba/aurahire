import { Inject, Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import {
  companiesTable,
  jobsTable,
  matchScoresTable,
  profilesTable,
  scoringConfigTable,
  type MatchScore,
  type Profile,
  type ScoringConfig,
} from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../../db/db.module";

export interface MatchScoreSample {
  matchScore: MatchScore;
  candidate: { id: string; fullName: string };
  job: { id: string; title: string; companyName: string };
}

export type ScoringConfigWithUpdatedBy = ScoringConfig & {
  updatedByProfile: Pick<Profile, "id" | "fullName" | "email"> | null;
};

@Injectable()
export class AdminConfigRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async getActive(): Promise<ScoringConfigWithUpdatedBy | null> {
    const [row] = await this.db
      .select({
        config: scoringConfigTable,
        profile: profilesTable,
      })
      .from(scoringConfigTable)
      .leftJoin(
        profilesTable,
        eq(profilesTable.id, scoringConfigTable.updatedBy),
      )
      .where(eq(scoringConfigTable.isActive, true))
      .limit(1);

    if (!row) return null;

    return {
      ...row.config,
      updatedByProfile: row.profile
        ? {
            id: row.profile.id,
            fullName: row.profile.fullName,
            email: row.profile.email,
          }
        : null,
    };
  }

  async update(
    id: string,
    patch: Partial<ScoringConfig>,
    updatedBy: string,
  ): Promise<ScoringConfig> {
    const [row] = await this.db
      .update(scoringConfigTable)
      .set({
        ...(patch as Record<string, unknown>),
        updatedBy,
        updatedAt: new Date(),
      })
      .where(eq(scoringConfigTable.id, id))
      .returning();
    if (!row) throw new Error("Scoring config update failed");
    return row;
  }

  async sampleRecentMatchScores(
    sampleSize: number,
  ): Promise<MatchScoreSample[]> {
    const rows = await this.db
      .select({
        matchScore: matchScoresTable,
        candidate: profilesTable,
        job: jobsTable,
        company: companiesTable,
      })
      .from(matchScoresTable)
      .innerJoin(
        profilesTable,
        eq(profilesTable.id, matchScoresTable.candidateId),
      )
      .innerJoin(jobsTable, eq(jobsTable.id, matchScoresTable.jobId))
      .innerJoin(companiesTable, eq(companiesTable.id, jobsTable.companyId))
      .orderBy(desc(matchScoresTable.createdAt))
      .limit(sampleSize);

    return rows.map((r) => ({
      matchScore: r.matchScore,
      candidate: { id: r.candidate.id, fullName: r.candidate.fullName },
      job: { id: r.job.id, title: r.job.title, companyName: r.company.name },
    }));
  }
}
