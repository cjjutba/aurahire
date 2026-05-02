import { z } from "zod";

// ============================================================================
// PRIMITIVE ATOMS — composed by feature schemas
// ============================================================================

export const uuidSchema = z.string().uuid({ message: "Must be a valid UUID" });

export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email format")
  .max(255)
  .toLowerCase();

export const phoneSchema = z
  .string()
  .min(7, "Phone too short")
  .max(20, "Phone too long")
  .regex(/^[\d\s+()-]+$/, "Phone may contain digits, spaces, +, (), -");

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password too long");

export const fullNameSchema = z
  .string()
  .min(2, "Name too short")
  .max(100, "Name too long");

export const companyNameSchema = z
  .string()
  .min(1, "Company name is required")
  .max(200);

// ============================================================================
// PAGINATION
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ============================================================================
// COMMON RESPONSE META
// ============================================================================

export const responseMetaSchema = z.object({
  requestId: z.string(),
  timestamp: z.string().datetime(),
});

export const paginatedMetaSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export type ResponseMeta = z.infer<typeof responseMetaSchema>;
export type PaginatedMeta = z.infer<typeof paginatedMetaSchema>;
