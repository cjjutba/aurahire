import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import {
  profilesTable,
  candidateProfilesTable,
  recruiterProfilesTable,
  companiesTable,
  companyMembersTable,
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

  /**
   * Initialize a recruiter at email-verification time WITHOUT creating a
   * company or membership. Company creation is deferred to the
   * /onboarding/start fork (create-vs-join) so recruiters who are being
   * invited to existing teams don't end up owning a stub company.
   * `last_active_company_id` stays null until the user picks a path.
   */
  async insertRecruiterWithoutCompany(
    profileData: NewProfile,
    recruiterData: Omit<NewRecruiterProfile, "id">,
  ): Promise<{ profile: Profile; recruiterProfile: RecruiterProfile }> {
    return await this.db.transaction(async (tx) => {
      const [profile] = await tx.insert(profilesTable).values(profileData).returning();
      if (!profile) throw new Error("Failed to insert profile");
      const [recruiterProfile] = await tx
        .insert(recruiterProfilesTable)
        .values({ ...recruiterData, id: profile.id })
        .returning();
      if (!recruiterProfile) throw new Error("Failed to insert recruiter profile");
      return { profile, recruiterProfile };
    });
  }

  async insertRecruiter(
    profileData: NewProfile,
    companyData: NewCompany,
    recruiterData: Omit<NewRecruiterProfile, "id">,
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
        .values({ ...recruiterData, id: profile.id })
        .returning();
      if (!recruiterProfile) throw new Error("Failed to insert recruiter profile");

      // Multi-tenancy: the new recruiter is the founding owner of their company.
      // Insert the corresponding company_members row + point profile at the
      // company so ActiveCompanyGuard's fallback path (and Phase 2b stopgap
      // reads of profiles.lastActiveCompanyId) resolve immediately.
      const now = new Date();
      await tx.insert(companyMembersTable).values({
        companyId: company.id,
        userId: profile.id,
        email: profile.email,
        role: "owner",
        status: "active",
        invitedAt: now,
        joinedAt: now,
      });
      await tx
        .update(profilesTable)
        .set({ lastActiveCompanyId: company.id, updatedAt: now })
        .where(eq(profilesTable.id, profile.id));

      // Reflect the lastActiveCompanyId update in the returned profile object
      // so callers that read it immediately don't have to re-fetch.
      profile.lastActiveCompanyId = company.id;

      return { profile, company, recruiterProfile };
    });
  }

  /**
   * Repoint a user's `last_active_company_id`. Pass null to clear it (used
   * when the user leaves their last company).
   */
  async setActiveCompany(
    userId: string,
    companyId: string | null,
  ): Promise<void> {
    await this.db
      .update(profilesTable)
      .set({ lastActiveCompanyId: companyId, updatedAt: new Date() })
      .where(eq(profilesTable.id, userId));
  }

  async updateProfile(
    id: string,
    patch: Partial<Pick<NewProfile, "fullName" | "phone">>,
  ): Promise<Profile> {
    const [row] = await this.db
      .update(profilesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(profilesTable.id, id))
      .returning();
    if (!row) throw new Error("Profile update failed");
    return row;
  }

  async updateRecruiterProfile(
    id: string,
    patch: Partial<NewRecruiterProfile>,
  ): Promise<RecruiterProfile> {
    const [row] = await this.db
      .update(recruiterProfilesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(recruiterProfilesTable.id, id))
      .returning();
    if (!row) throw new Error("Recruiter profile update failed");
    return row;
  }

  async updateCompany(
    id: string,
    patch: Partial<NewCompany>,
  ): Promise<Company> {
    const [row] = await this.db
      .update(companiesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(companiesTable.id, id))
      .returning();
    if (!row) throw new Error("Company update failed");
    return row;
  }

  async updateProfileAndRecruiterProfileTx(
    id: string,
    profilePatch: Partial<Pick<NewProfile, "fullName" | "phone">>,
    recruiterPatch: Partial<NewRecruiterProfile>,
  ): Promise<{ profile: Profile; recruiterProfile: RecruiterProfile }> {
    return await this.db.transaction(async (tx) => {
      const [profile] = await tx
        .update(profilesTable)
        .set({ ...profilePatch, updatedAt: new Date() })
        .where(eq(profilesTable.id, id))
        .returning();
      if (!profile) throw new Error("Profile update failed");

      const [recruiterProfile] = await tx
        .update(recruiterProfilesTable)
        .set({ ...recruiterPatch, updatedAt: new Date() })
        .where(eq(recruiterProfilesTable.id, id))
        .returning();
      if (!recruiterProfile) throw new Error("Recruiter profile update failed");

      return { profile, recruiterProfile };
    });
  }

  async updateCandidateProfile(
    id: string,
    patch: Partial<NewCandidateProfile>,
  ): Promise<CandidateProfile> {
    const [row] = await this.db
      .update(candidateProfilesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(candidateProfilesTable.id, id))
      .returning();
    if (!row) throw new Error("Candidate profile update failed");
    return row;
  }

  async updateProfileAndCandidateProfileTx(
    id: string,
    profilePatch: Partial<Pick<NewProfile, "fullName" | "phone">>,
    candidatePatch: Partial<NewCandidateProfile>,
  ): Promise<{ profile: Profile; candidateProfile: CandidateProfile }> {
    return await this.db.transaction(async (tx) => {
      const [profile] = await tx
        .update(profilesTable)
        .set({ ...profilePatch, updatedAt: new Date() })
        .where(eq(profilesTable.id, id))
        .returning();
      if (!profile) throw new Error("Profile update failed");

      const [candidateProfile] = await tx
        .update(candidateProfilesTable)
        .set({ ...candidatePatch, updatedAt: new Date() })
        .where(eq(candidateProfilesTable.id, id))
        .returning();
      if (!candidateProfile) throw new Error("Candidate profile update failed");

      return { profile, candidateProfile };
    });
  }
}
