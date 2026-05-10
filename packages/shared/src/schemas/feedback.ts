import { z } from "zod";
import { uuidSchema } from "./shared";
import { FEEDBACK_TYPE, FEEDBACK_SEVERITY, FEEDBACK_STATUS } from "../enums";

// ─── Submission (any authenticated user) ─────────────────────────────────

const subjectSchema = z
  .string()
  .trim()
  .min(3, "Subject must be at least 3 characters")
  .max(120, "Subject must be 120 characters or fewer");

const messageSchema = z
  .string()
  .trim()
  .min(10, "Message must be at least 10 characters")
  .max(4000, "Message must be 4000 characters or fewer");

export const createFeedbackSchema = z
  .object({
    type: z.enum(FEEDBACK_TYPE),
    severity: z.enum(FEEDBACK_SEVERITY).optional(),
    subject: subjectSchema,
    message: messageSchema,
    pageUrl: z.string().url().max(2048).nullable().optional(),
    userAgent: z.string().max(1024).nullable().optional(),
    appVersion: z.string().max(64).nullable().optional(),
  })
  .superRefine((val, ctx) => {
    // Severity is required for bugs and forbidden for everything else.
    // The DB enforces the same invariant; mirroring it client-side gives
    // immediate form feedback before the request leaves the browser.
    if (val.type === "bug" && !val.severity) {
      ctx.addIssue({
        code: "custom",
        path: ["severity"],
        message: "Severity is required for bug reports",
      });
    }
    if (val.type !== "bug" && val.severity) {
      ctx.addIssue({
        code: "custom",
        path: ["severity"],
        message: "Severity only applies to bug reports",
      });
    }
  });

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;

// ─── Admin list query ────────────────────────────────────────────────────

export const listFeedbackQuerySchema = z.object({
  status: z.enum(FEEDBACK_STATUS).optional(),
  type: z.enum(FEEDBACK_TYPE).optional(),
  severity: z.enum(FEEDBACK_SEVERITY).optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export type ListFeedbackQuery = z.infer<typeof listFeedbackQuerySchema>;

// ─── Admin update (status + admin note) ──────────────────────────────────

export const updateFeedbackSchema = z
  .object({
    status: z.enum(FEEDBACK_STATUS).optional(),
    adminNote: z.string().trim().max(4000).nullable().optional(),
  })
  .refine(
    (val) => val.status !== undefined || val.adminNote !== undefined,
    "Provide a status or admin note",
  );

export type UpdateFeedbackInput = z.infer<typeof updateFeedbackSchema>;
