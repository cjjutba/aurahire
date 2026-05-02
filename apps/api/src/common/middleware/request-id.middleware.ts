import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: FastifyRequest & { id?: string }, res: FastifyReply, next: () => void): void {
    const incoming = (req.headers["x-request-id"] as string | undefined) ?? null;
    const id = incoming && /^[a-zA-Z0-9-]{1,128}$/.test(incoming) ? incoming : randomUUID();
    req.id = id;
    void res.header("X-Request-Id", id);
    next();
  }
}
