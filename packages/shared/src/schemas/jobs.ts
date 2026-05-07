import { z } from "zod";
import {
  EMPLOYMENT_TYPE,
  WORK_MODE,
  EXPERIENCE_LEVEL,
  EDUCATION_REQUIREMENT,
  JOB_STATUS,
} from "../enums";
import { paginationSchema } from "./shared";

const moneySchema = z.coerce.number().int().nonnegative().nullable().optional();

export const createJobSchema = z
  .object({
    title: z.string().min(5, "Title too short").max(200, "Title too long"),
    department: z.string().max(150).nullable().optional(),
    employmentType: z.enum(EMPLOYMENT_TYPE),
    workMode: z.enum(WORK_MODE),
    locationCity: z.string().max(100).nullable().optional(),
    locationRegion: z.string().max(100).nullable().optional(),
    locationCountry: z.string().max(100).nullable().optional(),
    salaryMin: moneySchema,
    salaryMax: moneySchema,
    salaryCurrency: z.string().length(3).default("USD"),
    description: z.string().min(20, "Description too short"),
    descriptionPlain: z.string().min(20, "Plain text mirror required"),
    requiredSkills: z.array(z.string().min(1)).max(50).default([]),
    experienceLevel: z.enum(EXPERIENCE_LEVEL),
    educationRequirement: z.enum(EDUCATION_REQUIREMENT).nullable().optional(),
    applicationDeadline: z.string().date().nullable().optional(),
    // When true, the backend transitions the new job to 'published' in the
    // same call (after running the bias scan). On bias-flag failure the job
    // remains as draft so the recruiter can resolve flags and retry from the
    // job detail page. When false/omitted, the job is created as 'draft'.
    publishImmediately: z.boolean().optional().default(false),
  })
  .refine(
    (data) =>
      data.salaryMin == null || data.salaryMax == null || data.salaryMax >= data.salaryMin,
    { message: "salaryMax must be >= salaryMin", path: ["salaryMax"] },
  );

export type CreateJobInput = z.infer<typeof createJobSchema>;

export const updateJobSchema = z
  .object({
    title: z.string().min(5).max(200).optional(),
    department: z.string().max(150).nullable().optional(),
    employmentType: z.enum(EMPLOYMENT_TYPE).optional(),
    workMode: z.enum(WORK_MODE).optional(),
    locationCity: z.string().max(100).nullable().optional(),
    locationRegion: z.string().max(100).nullable().optional(),
    locationCountry: z.string().max(100).nullable().optional(),
    salaryMin: moneySchema,
    salaryMax: moneySchema,
    salaryCurrency: z.string().length(3).optional(),
    description: z.string().min(20).optional(),
    descriptionPlain: z.string().min(20).optional(),
    requiredSkills: z.array(z.string().min(1)).max(50).optional(),
    experienceLevel: z.enum(EXPERIENCE_LEVEL).optional(),
    educationRequirement: z.enum(EDUCATION_REQUIREMENT).nullable().optional(),
    applicationDeadline: z.string().date().nullable().optional(),
  })
  .refine(
    (data) =>
      data.salaryMin == null || data.salaryMax == null || data.salaryMax >= data.salaryMin,
    { message: "salaryMax must be >= salaryMin", path: ["salaryMax"] },
  );

export type UpdateJobInput = z.infer<typeof updateJobSchema>;

export const listJobsQuerySchema = paginationSchema.extend({
  q: z.string().max(200).optional(),
  mode: z.enum(WORK_MODE).optional(),
  experienceLevel: z.enum(EXPERIENCE_LEVEL).optional(),
  locationCountry: z.string().max(100).optional(),
  sort: z
    .enum(["recent", "best-match", "salary-high", "recent-activity"])
    .default("recent")
    .optional(),
  status: z.enum(JOB_STATUS).optional(),
  include: z.enum(["stats"]).optional(),
});

export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
