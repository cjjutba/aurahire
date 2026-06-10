import { z } from "zod";
import {
  emailSchema,
  phoneSchema,
  passwordSchema,
  fullNameSchema,
} from "./shared";

// ============================================================================
// LOGIN
// ============================================================================

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ============================================================================
// REGISTER - CANDIDATE
// ============================================================================

export const registerCandidateSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    agreedToTerms: z.literal(true, {
      errorMap: () => ({ message: "You must agree to the terms" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterCandidateInput = z.infer<typeof registerCandidateSchema>;

// Backend signup payload - frontend forwards the full registration to NestJS,
// which creates the Supabase auth user, issues a verification token, and emails it.
export const signupCandidateSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

export type SignupCandidateInput = z.infer<typeof signupCandidateSchema>;

// Internal payload used by ProfilesService.initCandidateProfile - the candidate
// row is created server-side after email verification, not over the wire.
export const initCandidateProfileSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
});

export type InitCandidateProfileInput = z.infer<
  typeof initCandidateProfileSchema
>;

// ============================================================================
// REGISTER - RECRUITER
// ============================================================================

export const registerRecruiterSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    agreedToTerms: z.literal(true, {
      errorMap: () => ({ message: "You must agree to the terms" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterRecruiterInput = z.infer<typeof registerRecruiterSchema>;

export const signupRecruiterSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

export type SignupRecruiterInput = z.infer<typeof signupRecruiterSchema>;

// Internal payload used by ProfilesService.initRecruiterProfile. Company
// creation is now deferred to /onboarding/start (the create-vs-join fork),
// so the recruiter row is created without a company on email verification.
export const initRecruiterProfileSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
});

export type InitRecruiterProfileInput = z.infer<
  typeof initRecruiterProfileSchema
>;

// ============================================================================
// PASSWORD RESET
// ============================================================================

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token is required"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ============================================================================
// EMAIL VERIFICATION
// ============================================================================

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

// Backend strips the password field; only token + new password go on the wire.
export const resetPasswordRequestSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: passwordSchema,
});

export type ResetPasswordRequestInput = z.infer<
  typeof resetPasswordRequestSchema
>;
