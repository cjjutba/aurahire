import { relations } from "drizzle-orm";
import {
  profilesTable,
  candidateProfilesTable,
  recruiterProfilesTable,
  companiesTable,
  jobsTable,
  resumesTable,
  applicationsTable,
  interviewsTable,
  offersTable,
  profileScoresTable,
  matchScoresTable,
  evidenceExcerptsTable,
  biasFlagsTable,
  scoringConfigTable,
  auditLogsTable,
} from "./schema.ts";

export const profilesRelations = relations(profilesTable, ({ one, many }) => ({
  candidateProfile: one(candidateProfilesTable, {
    fields: [profilesTable.id],
    references: [candidateProfilesTable.id],
  }),
  recruiterProfile: one(recruiterProfilesTable, {
    fields: [profilesTable.id],
    references: [recruiterProfilesTable.id],
  }),
  resumes: many(resumesTable),
  applicationsAsCandidate: many(applicationsTable),
  jobsAsRecruiter: many(jobsTable),
  companiesCreated: many(companiesTable),
  auditLogsAsActor: many(auditLogsTable),
}));

export const candidateProfilesRelations = relations(candidateProfilesTable, ({ one, many }) => ({
  profile: one(profilesTable, {
    fields: [candidateProfilesTable.id],
    references: [profilesTable.id],
  }),
  defaultResume: one(resumesTable, {
    fields: [candidateProfilesTable.defaultResumeId],
    references: [resumesTable.id],
  }),
}));

export const recruiterProfilesRelations = relations(recruiterProfilesTable, ({ one }) => ({
  profile: one(profilesTable, {
    fields: [recruiterProfilesTable.id],
    references: [profilesTable.id],
  }),
  company: one(companiesTable, {
    fields: [recruiterProfilesTable.companyId],
    references: [companiesTable.id],
  }),
}));

export const companiesRelations = relations(companiesTable, ({ one, many }) => ({
  createdByProfile: one(profilesTable, {
    fields: [companiesTable.createdBy],
    references: [profilesTable.id],
  }),
  recruiters: many(recruiterProfilesTable),
  jobs: many(jobsTable),
}));

export const jobsRelations = relations(jobsTable, ({ one, many }) => ({
  recruiter: one(profilesTable, {
    fields: [jobsTable.recruiterId],
    references: [profilesTable.id],
  }),
  company: one(companiesTable, {
    fields: [jobsTable.companyId],
    references: [companiesTable.id],
  }),
  applications: many(applicationsTable),
  biasFlags: many(biasFlagsTable),
}));

export const resumesRelations = relations(resumesTable, ({ one, many }) => ({
  candidate: one(profilesTable, {
    fields: [resumesTable.candidateId],
    references: [profilesTable.id],
  }),
  applications: many(applicationsTable),
}));

export const applicationsRelations = relations(applicationsTable, ({ one, many }) => ({
  job: one(jobsTable, {
    fields: [applicationsTable.jobId],
    references: [jobsTable.id],
  }),
  candidate: one(profilesTable, {
    fields: [applicationsTable.candidateId],
    references: [profilesTable.id],
  }),
  resume: one(resumesTable, {
    fields: [applicationsTable.resumeId],
    references: [resumesTable.id],
  }),
  matchScore: one(matchScoresTable, {
    fields: [applicationsTable.id],
    references: [matchScoresTable.applicationId],
  }),
  interviews: many(interviewsTable),
  offer: one(offersTable, {
    fields: [applicationsTable.id],
    references: [offersTable.applicationId],
  }),
}));

export const interviewsRelations = relations(interviewsTable, ({ one }) => ({
  application: one(applicationsTable, {
    fields: [interviewsTable.applicationId],
    references: [applicationsTable.id],
  }),
  scheduledByProfile: one(profilesTable, {
    fields: [interviewsTable.scheduledBy],
    references: [profilesTable.id],
  }),
}));

export const offersRelations = relations(offersTable, ({ one }) => ({
  application: one(applicationsTable, {
    fields: [offersTable.applicationId],
    references: [applicationsTable.id],
  }),
  sentByProfile: one(profilesTable, {
    fields: [offersTable.sentBy],
    references: [profilesTable.id],
  }),
}));

export const profileScoresRelations = relations(profileScoresTable, ({ one }) => ({
  candidate: one(profilesTable, {
    fields: [profileScoresTable.candidateId],
    references: [profilesTable.id],
  }),
  resume: one(resumesTable, {
    fields: [profileScoresTable.resumeId],
    references: [resumesTable.id],
  }),
}));

export const matchScoresRelations = relations(matchScoresTable, ({ one }) => ({
  application: one(applicationsTable, {
    fields: [matchScoresTable.applicationId],
    references: [applicationsTable.id],
  }),
  candidate: one(profilesTable, {
    fields: [matchScoresTable.candidateId],
    references: [profilesTable.id],
  }),
  job: one(jobsTable, {
    fields: [matchScoresTable.jobId],
    references: [jobsTable.id],
  }),
  resume: one(resumesTable, {
    fields: [matchScoresTable.resumeId],
    references: [resumesTable.id],
  }),
}));

export const biasFlagsRelations = relations(biasFlagsTable, ({ one }) => ({
  job: one(jobsTable, {
    fields: [biasFlagsTable.jobId],
    references: [jobsTable.id],
  }),
  overriddenByProfile: one(profilesTable, {
    fields: [biasFlagsTable.overriddenBy],
    references: [profilesTable.id],
  }),
}));

export const scoringConfigRelations = relations(scoringConfigTable, ({ one }) => ({
  updatedByProfile: one(profilesTable, {
    fields: [scoringConfigTable.updatedBy],
    references: [profilesTable.id],
  }),
}));

export const auditLogsRelations = relations(auditLogsTable, ({ one }) => ({
  actor: one(profilesTable, {
    fields: [auditLogsTable.actorId],
    references: [profilesTable.id],
  }),
}));
