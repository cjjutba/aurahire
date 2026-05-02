import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import {
  profilesTable,
  candidateProfilesTable,
  recruiterProfilesTable,
  companiesTable,
  type Profile,
  type NewProfile,
  type CandidateProfile,
  type NewCandidateProfile,
  type RecruiterProfile,
  type NewRecruiterProfile,
  type Company,
  type NewCompany,
} from "@aurahire/db";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";

@Injectable()
export class ProfilesRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async findById(id: string): Promise<Profile | null> {
    const rows = await this.db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findCandidateProfile(id: string): Promise<CandidateProfile | null> {
    const rows = await this.db
      .select()
      .from(candidateProfilesTable)
      .where(eq(candidateProfilesTable.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findRecruiterProfile(id: string): Promise<RecruiterProfile | null> {
    const rows = await this.db
      .select()
      .from(recruiterProfilesTable)
      .where(eq(recruiterProfilesTable.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findCompanyById(id: string): Promise<Company | null> {
    const rows = await this.db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async insertCandidate(
    profileData: NewProfile,
    candidateData: Omit<NewCandidateProfile, "id">,
  ): Promise<{ profile: Profile; candidateProfile: CandidateProfile }> {
    return await this.db.transaction(async (tx) => {
      const [profile] = await tx.insert(profilesTable).values(profileData).returning();
      if (!profile) throw new Error("Failed to insert profile");
      const [candidateProfile] = await tx
        .insert(candidateProfilesTable)
        .values({ ...candidateData, id: profile.id })
        .returning();
      if (!candidateProfile) throw new Error("Failed to insert candidate profile");
      return { profile, candidateProfile };
    });
  }

  async insertRecruiter(
    profileData: NewProfile,
    companyData: NewCompany,
    recruiterData: Omit<NewRecruiterProfile, "id" | "companyId">,
  ): Promise<{
    profile: Profile;
    company: Company;
    recruiterProfile: RecruiterProfile;
  }> {
    return await this.db.transaction(async (tx) => {
      const [profile] = await tx.insert(profilesTable).values(profileData).returning();
      if (!profile) throw new Error("Failed to insert profile");
      const [company] = await tx
        .insert(companiesTable)
        .values({ ...companyData, createdBy: profile.id })
        .returning();
      if (!company) throw new Error("Failed to insert company");
      const [recruiterProfile] = await tx
        .insert(recruiterProfilesTable)
        .values({ ...recruiterData, id: profile.id, companyId: company.id })
        .returning();
      if (!recruiterProfile) throw new Error("Failed to insert recruiter profile");
      return { profile, company, recruiterProfile };
    });
  }
}
