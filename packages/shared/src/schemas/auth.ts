import { z } from "zod";
import {
  emailSchema,
  phoneSchema,
  passwordSchema,
  fullNameSchema,
  companyNameSchema,
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
// REGISTER — CANDIDATE
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

// Subset used at the backend init endpoint (frontend calls Supabase signUp directly,
// then sends the new user's profile data here)
export const initCandidateProfileSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
});

export type InitCandidateProfileInput = z.infer<typeof initCandidateProfileSchema>;

// ============================================================================
// REGISTER — RECRUITER
// ============================================================================

export const registerRecruiterSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    phone: phoneSchema,
    companyName: companyNameSchema,
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

export const initRecruiterProfileSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  companyName: companyNameSchema,
});

export type InitRecruiterProfileInput = z.infer<typeof initRecruiterProfileSchema>;

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
