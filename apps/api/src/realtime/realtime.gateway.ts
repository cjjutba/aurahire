import { Inject, Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { DefaultEventsMap, Server, Socket } from "socket.io";
import { eq, and } from "drizzle-orm";
import { jobsTable } from "@aurahire/db";
import {
  type AuthUser,
  type SubscribeMessage as SubscribeMessageType,
  subscribeMessageSchema,
} from "@aurahire/shared";

import { Rooms } from "./room.constants";
import { WsJwtUtil } from "./ws-jwt.util";
import { SocketRateLimiter } from "./realtime-rate-limit";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../db/db.module";

interface SocketData {
  user?: AuthUser;
}
type AuthSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

/**
 * Single Socket.io entry point for the API.
 *
 * Responsibilities:
 *  - Authenticate the JWT presented in the handshake (`auth.token`).
 *  - Auto-join role-scoped rooms on connect.
 *  - Validate ownership before joining resource-scoped rooms (`subscribe`).
 *  - Publish the io server instance for `EventsService` to broadcast against.
 */
@WebSocketGateway({
  cors: {
    origin: (origin, cb) => {
      const allowed = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
        .split(",")
        .map((o) => o.trim());
      if (!origin || allowed.includes(origin)) cb(null, true);
      else cb(new Error("CORS"), false);
    },
    credentials: true,
  },
  path: "/socket.io",
  transports: ["websocket", "polling"],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly limiter = new SocketRateLimiter();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: WsJwtUtil,
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
  ) {}

  afterInit(server: Server): void {
    // @WebSocketServer() already populates this.server; the explicit
    // assignment is intentionally absent.
    // Auth runs as Socket.io middleware so that rejection happens BEFORE the
    // connection completes. Calling next(err) makes Socket.io serialize the
    // error to the client as a transport-level connect_error with err.data
    // populated - which is what the SocketProvider's connect_error listener
    // observes. Doing the check inside handleConnection (post-connect) would
    // not surface it that way.
    server.use(async (socket, next) => {
      const handshakeAuth = socket.handshake.auth as
        | { token?: unknown }
        | undefined;
      const rawToken = handshakeAuth?.token;
      const token = typeof rawToken === "string" ? rawToken : undefined;
      const user = await this.jwt.authenticate(token);
      if (!user) {
        this.logger.warn(
          `WS handshake rejected (auth) for client ${socket.id}`,
        );
        const err: Error & { data?: { code: string } } = new Error(
          "UNAUTHORIZED",
        );
        err.data = { code: "UNAUTHORIZED" };
        next(err);
        return;
      }
      (socket.data as SocketData).user = user;
      next();
    });
    this.logger.log("Realtime gateway initialized");
  }

  handleConnection(client: AuthSocket): void {
    // Auth ran in the middleware above; user is guaranteed to be present.
    const user = client.data.user;
    if (!user) {
      // Defensive - shouldn't reach here. If it does, force-close.
      client.disconnect(true);
      return;
    }

    const joined: string[] = [];
    void client.join(Rooms.user(user.id));
    joined.push(Rooms.user(user.id));

    if (user.role === "recruiter") {
      void client.join(Rooms.recruiter(user.id));
      joined.push(Rooms.recruiter(user.id));
    }
    if (user.role === "admin") {
      void client.join(Rooms.roleAdmin());
      joined.push(Rooms.roleAdmin());
    }

    client.emit("connected", {
      userId: user.id,
      role: user.role,
      joinedRooms: joined,
    });

    this.logger.log(
      `WS connect ${client.id} user=${user.id} role=${user.role} rooms=${joined.length}`,
    );
  }

  handleDisconnect(client: AuthSocket): void {
    this.limiter.forget(client.id);
    const userId = client.data.user?.id ?? "anon";
    this.logger.log(`WS disconnect ${client.id} user=${userId}`);
  }

  @SubscribeMessage("subscribe")
  async onSubscribe(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    if (!this.limiter.allow(client.id, "subscribe")) {
      client.emit("subscribe_error", { reason: "rate_limited" });
      client.disconnect(true);
      return;
    }
    const user = client.data.user;
    if (!user) {
      client.emit("subscribe_error", { reason: "unauthorized" });
      return;
    }

    const parsed = subscribeMessageSchema.safeParse(body);
    if (!parsed.success) {
      client.emit("subscribe_error", { reason: "invalid_payload" });
      return;
    }
    const msg: SubscribeMessageType = parsed.data;

    const allowed = await this.canAccessResource(user, msg);
    if (!allowed) {
      client.emit("subscribe_error", {
        resource: msg.resource,
        id: msg.id,
        reason: "forbidden",
      });
      return;
    }

    const room = this.roomForResource(msg);
    if (!room) {
      client.emit("subscribe_error", {
        resource: msg.resource,
        id: msg.id,
        reason: "unknown_resource",
      });
      return;
    }
    void client.join(room);
    client.emit("subscribed", { resource: msg.resource, id: msg.id });
  }

  @SubscribeMessage("unsubscribe")
  onUnsubscribe(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: unknown,
  ): void {
    if (!this.limiter.allow(client.id, "unsubscribe")) {
      client.disconnect(true);
      return;
    }
    const parsed = subscribeMessageSchema.safeParse(body);
    if (!parsed.success) return;
    const room = this.roomForResource(parsed.data);
    if (room) void client.leave(room);
  }

  private roomForResource(msg: SubscribeMessageType): string | null {
    if (msg.resource === "job") return Rooms.job(msg.id);
    return null;
  }

  private async canAccessResource(
    user: AuthUser,
    msg: SubscribeMessageType,
  ): Promise<boolean> {
    if (msg.resource === "job") {
      // Admins can subscribe to any job.
      if (user.role === "admin") return true;
      // Recruiters can subscribe to jobs they own.
      if (user.role === "recruiter") {
        const rows = await this.db
          .select({ id: jobsTable.id })
          .from(jobsTable)
          .where(
            and(eq(jobsTable.id, msg.id), eq(jobsTable.recruiterId, user.id)),
          )
          .limit(1);
        return rows.length === 1;
      }
      return false;
    }
    return false;
  }
}
