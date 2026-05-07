import { Injectable, Logger } from "@nestjs/common";
import {
  RealtimeEvent,
  type ApplicationCreatedPayload,
  type ApplicationStatusChangedPayload,
  type AuditEntryPayload,
  type BiasFlagCreatedPayload,
  type InterviewScheduledPayload,
  type InterviewStatusChangedPayload,
  type OfferSentPayload,
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
        server.to([...rooms]).emit(event, payload);
      } catch (err) {
        this.logger.warn(
          `Realtime emit failed for ${event}: ${(err as Error).message}`,
        );
      }
    });
  }
}
