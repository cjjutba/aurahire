import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

// NestJS middleware on the Fastify adapter runs through @fastify/middie, which
// passes Node's raw IncomingMessage/ServerResponse — not FastifyRequest/Reply.
// Use the raw Node API (setHeader) here, not Fastify's reply.header().
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(
    req: IncomingMessage & { id?: string },
    res: ServerResponse,
    next: () => void,
  ): void {
    const incoming =
      (req.headers["x-request-id"] as string | undefined) ?? null;
    const id =
      incoming && /^[a-zA-Z0-9-]{1,128}$/.test(incoming)
        ? incoming
        : randomUUID();
    req.id = id;
    res.setHeader("X-Request-Id", id);
    next();
  }
}
