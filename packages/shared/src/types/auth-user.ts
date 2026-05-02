import type { UserRole, UserStatus } from "../enums";

/**
 * The authenticated user, attached to req.user by SupabaseAuthGuard.
 * Frontend code that calls /api/v1/profiles/me sees the same shape.
 */
export interface AuthUser {
  id: string; // Supabase auth.users.id (also profiles.id)
  email: string;
  role: UserRole;
  status: UserStatus;
  fullName: string;
  profileCompleted: boolean;
}
