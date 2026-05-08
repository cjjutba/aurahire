import { Injectable, Logger } from "@nestjs/common";
import {
  RealtimeEvent,
  type ApplicationCreatedPayload,
  type ApplicationRecommendationSetPayload,
  type ApplicationScoredPayload,
  type ApplicationStatusChangedPayload,
  type ApplicationWithdrawnPayload,
  type AuditEntryPayload,
  type BiasFlagCreatedPayload,
  type InterviewCompletedPayload,
  type InterviewFeedbackSharedPayload,
  type InterviewRescheduledPayload,
  type InterviewScheduledPayload,
  type InterviewStatusChangedPayload,
  type MatchPreviewCreatedPayload,
  type NotificationArchiveAllPayload,
  type NotificationArchivedPayload,
  type NotificationCreatedPayload,
  type NotificationReadPayload,
  type OfferSentPayload,
  type ProfileScoreUpdatedPayload,
} from "@aurahire/shared";

import { Rooms } from "./room.constants";
import { RealtimeGateway } from "./realtime.gateway";

/**
 * The injectable that mutating services call after a successful DB write.
 *
 * Discipline:
 *  - Emission failures are caught and logged; they NEVER propagate to the
 *    caller. The DB write already succeeded; a missed broadcast degrades to
 *    "user refreshes to see it."
 *  - Emissions run through `setImmediate` so the controller response is not
 *    blocked by socket I/O.
 *  - Room targets are computed inside this service so callers don't reach
 *    into Socket.io directly.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  emitApplicationCreated(payload: ApplicationCreatedPayload): void {
    this.broadcast(
      RealtimeEvent.ApplicationCreated,
      payload,
      [Rooms.recruiter(payload.recruiterId), Rooms.job(payload.jobId)],
    );
  }

  emitApplicationStatusChanged(payload: ApplicationStatusChangedPayload): void {
    this.broadcast(
      RealtimeEvent.ApplicationStatusChanged,
      payload,
      [
        Rooms.user(payload.candidateId),
        Rooms.recruiter(payload.recruiterId),
        Rooms.job(payload.jobId),
      ],
    );
  }

  emitApplicationScored(payload: ApplicationScoredPayload): void {
    this.broadcast(
      RealtimeEvent.ApplicationScored,
      payload,
      [
        Rooms.user(payload.candidateId),
        Rooms.recruiter(payload.recruiterId),
        Rooms.job(payload.jobId),
      ],
    );
  }

  emitApplicationWithdrawn(payload: ApplicationWithdrawnPayload): void {
    this.broadcast(
      RealtimeEvent.ApplicationWithdrawn,
      payload,
      [Rooms.user(payload.candidateId), Rooms.job(payload.jobId)],
    );
  }

  emitApplicationRecommendationSet(payload: ApplicationRecommendationSetPayload): void {
    this.broadcast(
      RealtimeEvent.ApplicationRecommendationSet,
      payload,
      [Rooms.recruiter(payload.recruiterId)],
    );
  }

  emitInterviewScheduled(payload: InterviewScheduledPayload): void {
    this.broadcast(
      RealtimeEvent.InterviewScheduled,
      payload,
      [Rooms.user(payload.candidateId), Rooms.recruiter(payload.recruiterId)],
    );
  }

  emitInterviewStatusChanged(payload: InterviewStatusChangedPayload): void {
    this.broadcast(
      RealtimeEvent.InterviewStatusChanged,
      payload,
      [Rooms.user(payload.candidateId), Rooms.recruiter(payload.recruiterId)],
    );
  }

  emitInterviewRescheduled(payload: InterviewRescheduledPayload): void {
    this.broadcast(
      RealtimeEvent.InterviewRescheduled,
      payload,
      [Rooms.user(payload.candidateId), Rooms.recruiter(payload.recruiterId)],
    );
  }

  emitInterviewCompleted(payload: InterviewCompletedPayload): void {
    this.broadcast(
      RealtimeEvent.InterviewCompleted,
      payload,
      [
        Rooms.user(payload.candidateId),
        Rooms.recruiter(payload.recruiterId),
        Rooms.job(payload.jobId),
      ],
    );
  }

  emitInterviewFeedbackShared(payload: InterviewFeedbackSharedPayload): void {
    // Targets the candidate (in-app surfacing on candidate detail page)
    // and the recruiter (so recruiter UI updates "shared at" timestamp).
    this.broadcast(
      RealtimeEvent.InterviewFeedbackShared,
      payload,
      [Rooms.user(payload.candidateId), Rooms.recruiter(payload.recruiterId)],
    );
  }

  emitOfferSent(payload: OfferSentPayload): void {
    this.broadcast(
      RealtimeEvent.OfferSent,
      payload,
      [Rooms.user(payload.candidateId), Rooms.recruiter(payload.recruiterId)],
    );
  }

  emitAuditEntry(payload: AuditEntryPayload): void {
    this.broadcast(RealtimeEvent.AuditEntry, payload, [Rooms.roleAdmin()]);
  }

  emitBiasFlagCreated(payload: BiasFlagCreatedPayload): void {
    this.broadcast(RealtimeEvent.BiasFlagCreated, payload, [Rooms.roleAdmin()]);
  }

  emitMatchPreviewCreated(payload: MatchPreviewCreatedPayload): void {
    this.broadcast(
      RealtimeEvent.MatchPreviewCreated,
      payload,
      [Rooms.user(payload.candidateId)],
    );
  }

  emitProfileScoreUpdated(payload: ProfileScoreUpdatedPayload): void {
    this.broadcast(
      RealtimeEvent.ProfileScoreUpdated,
      payload,
      [Rooms.user(payload.candidateId)],
    );
  }

  emitNotificationCreated(payload: NotificationCreatedPayload): void {
    this.broadcast(
      RealtimeEvent.NotificationCreated,
      payload,
      [Rooms.user(payload.userId)],
    );
  }

  emitNotificationRead(userId: string, payload: NotificationReadPayload): void {
    this.broadcast(RealtimeEvent.NotificationRead, payload, [Rooms.user(userId)]);
  }

  emitNotificationArchived(
    userId: string,
    payload: NotificationArchivedPayload,
  ): void {
    this.broadcast(RealtimeEvent.NotificationArchived, payload, [
      Rooms.user(userId),
    ]);
  }

  emitNotificationArchiveAll(
    userId: string,
    payload: NotificationArchiveAllPayload,
  ): void {
    this.broadcast(RealtimeEvent.NotificationArchiveAll, payload, [
      Rooms.user(userId),
    ]);
  }

  private broadcast(
    event: string,
    payload: unknown,
    rooms: readonly string[],
  ): void {
    setImmediate(() => {
      try {
        const server = this.gateway.server;
        if (!server) {
          // Gateway not yet initialized (boot path or test); silently drop.
          return;
        }
        // Socket.io accepts a readonly tuple-of-rooms — no copy needed.
        server.to(rooms as string[]).emit(event, payload);
      } catch (err) {
        // Include rooms + payload-key set so an ops alert points at the
        // affected tenant/scope rather than just the event name.
        const payloadKeys =
          payload && typeof payload === "object"
            ? Object.keys(payload as Record<string, unknown>).join(",")
            : "<non-object>";
        this.logger.warn(
          `Realtime emit failed for ${event}: ${(err as Error).message} (rooms=${rooms.join("|")} payloadKeys=${payloadKeys})`,
        );
      }
    });
  }
}
