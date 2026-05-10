import { z } from "zod";
import { companyNameSchema, emailSchema, uuidSchema } from "./shared";
import { COMPANY_MEMBER_ROLE, COMPANY_SIZE } from "../enums";

// ============================================================================
// COMPANY CRUD
// ============================================================================

// Treat empty / whitespace-only strings as "not provided" so optional URL
// fields don't fail `.url()` when the user leaves them blank in a form.
const optionalUrlSchema = z
  .string()
  .nullish()
  .refine((v) => {
    if (v == null || v.trim() === "") return true;
    if (v.length > 2048) return false;
    try {
      new URL(v);
      return true;
    } catch {
      return false;
    }
  }, "Must be a valid URL")
  .transform((v) => (v == null || v.trim() === "" ? null : v));

const optionalShortText = (max: number) =>
  z.string().max(max).nullable().optional();

export const createCompanySchema = z.object({
  name: companyNameSchema,
  industry: optionalShortText(120),
  size: z.enum(COMPANY_SIZE).nullable().optional(),
  website: optionalUrlSchema,
  logoUrl: optionalUrlSchema,
  headquartersLocation: optionalShortText(200),
  description: z.string().max(4000).nullable().optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const updateCompanySchema = createCompanySchema.partial();

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

// ============================================================================
// COMPANY DELETION
// ============================================================================

export const deleteCompanySchema = z.object({
  /**
   * The exact name of the company. Server-side double-confirmation pattern —
   * mistyping the name aborts the delete.
   */
  confirmName: z.string().min(1, "Type the company name to confirm"),
});

export type DeleteCompanyInput = z.infer<typeof deleteCompanySchema>;

// ============================================================================
// MEMBERSHIP
// ============================================================================

// 'owner' is omitted from the invite role pool — owners are minted only at
// company creation or via explicit ownership transfer.
const inviteableRoleSchema = z.enum(["admin", "recruiter"] as const);

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: inviteableRoleSchema,
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberSchema = z.object({
  role: z.enum(COMPANY_MEMBER_ROLE),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const transferOwnershipSchema = z.object({
  /**
   * The exact email of the target member. Anti-misclick guard —
   * mistyping aborts the transfer.
   */
  confirmEmail: emailSchema,
});

export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;

// ============================================================================
// INVITATIONS (token-driven)
// ============================================================================

export const invitationTokenSchema = z.object({
  token: z.string().min(16).max(256),
});

export type InvitationTokenInput = z.infer<typeof invitationTokenSchema>;

export const invitationPreviewQuerySchema = z.object({
  token: z.string().min(16).max(256),
});

export type InvitationPreviewQuery = z.infer<
  typeof invitationPreviewQuerySchema
>;

// ============================================================================
// PROFILE — ACTIVE COMPANY SWITCH
// ============================================================================

/**
 * The first incarnation of PATCH /profiles/me. Phase 2b only allows changing
 * the active-company pointer; full profile editing arrives in Phase 5.
 */
export const updateMyProfileSchema = z.object({
  lastActiveCompanyId: uuidSchema.optional(),
});

export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;
