import { z } from "zod";

import { JOB_STATUS, USER_ROLES, USER_STATUS } from "../enums/index.ts";
import { uuidSchema } from "./shared.ts";

// ---------- LIST USERS QUERY ----------
export const listAdminUsersQuerySchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUS).optional(),
  q: z.string().max(200).optional(),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;

// ---------- SUSPEND USER ----------
export const suspendUserSchema = z.object({
  reason: z
    .string()
    .min(10, "Reason must be at least 10 characters")
    .max(1000, "Reason cannot exceed 1000 characters"),
});
export type SuspendUserInput = z.infer<typeof suspendUserSchema>;

// ---------- CHANGE ROLE ----------
export const changeUserRoleSchema = z.object({
  newRole: z.enum(USER_ROLES),
});
export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;

// ---------- LIST JOBS QUERY ----------
export const listAdminJobsQuerySchema = z.object({
  status: z.enum(JOB_STATUS).optional(),
  recruiterId: uuidSchema.optional(),
  hasBiasFlags: z.coerce.boolean().optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAdminJobsQuery = z.infer<typeof listAdminJobsQuerySchema>;
