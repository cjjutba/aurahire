import { RealtimeEvent } from "@aurahire/shared";

/**
 * Room key builders. Keep these centralized so both gateway joins and
 * EventsService emits agree on naming.
 */
export const Rooms = {
  user: (userId: string): string => `user:${userId}`,
  recruiter: (recruiterId: string): string => `recruiter:${recruiterId}`,
  job: (jobId: string): string => `job:${jobId}`,
  roleAdmin: (): string => `role:admin`,
} as const;

/**
 * Re-exported for backend code paths that don't otherwise import from
 * @aurahire/shared.
 */
export const Events = RealtimeEvent;
