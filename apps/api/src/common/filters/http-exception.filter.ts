import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ZodError } from "zod";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ServerResponse } from "node:http";
import type { ApiErrorResponse } from "@aurahire/shared";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    // When a route handler throws, this is FastifyReply. When NestJS middleware
    // (running through @fastify/middie) throws, this is the raw Node ServerResponse.
    const res = ctx.getResponse<FastifyReply | ServerResponse>();
    const req = ctx.getRequest<FastifyRequest & { id?: string }>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_ERROR";
    let message = "Something went wrong";
    let errors: ApiErrorResponse["errors"] = undefined;
    let extras: Record<string, unknown> = {};

    if (exception instanceof ZodError) {
      statusCode = HttpStatus.BAD_REQUEST;
      code = "VALIDATION_FAILED";
      message = "Validation failed";
      errors = exception.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      }));
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exRes = exception.getResponse();
      if (typeof exRes === "object" && exRes !== null) {
        const body = exRes as Record<string, unknown>;
        code =
          (body.code as string | undefined) ?? this.codeFromStatus(statusCode);
        message = (body.message as string | undefined) ?? exception.message;
        if (Array.isArray(body.errors)) {
          errors = body.errors as ApiErrorResponse["errors"];
        }
        // Preserve any additional fields from the exception body so callers
        // (e.g., bias-check 422 with `flags`) can read structured context.
        const reserved = new Set(["statusCode", "code", "message", "errors"]);
        for (const [k, v] of Object.entries(body)) {
          if (!reserved.has(k)) extras[k] = v;
        }
      } else {
        code = this.codeFromStatus(statusCode);
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
      this.logger.error(
        `Unhandled error: ${exception.stack ?? exception.message}`,
      );
    } else {
      this.logger.error(`Unknown exception: ${JSON.stringify(exception)}`);
    }

    const body: ApiErrorResponse & Record<string, unknown> = {
      statusCode,
      code,
      message,
      ...(errors ? { errors } : {}),
      ...extras,
      timestamp: new Date().toISOString(),
      path: req.url,
      requestId: req.id ?? "unknown",
    };

    if (typeof (res as FastifyReply).status === "function") {
      void (res as FastifyReply).status(statusCode).send(body);
    } else {
      const raw = res as ServerResponse;
      raw.statusCode = statusCode;
      raw.setHeader("content-type", "application/json; charset=utf-8");
      raw.end(JSON.stringify(body));
    }
  }

  private codeFromStatus(status: number): string {
    switch (status) {
      case 400:
        return "BAD_REQUEST";
      case 401:
        return "UNAUTHORIZED";
      case 403:
        return "FORBIDDEN";
      case 404:
        return "NOT_FOUND";
      case 409:
        return "CONFLICT";
      case 422:
        return "UNPROCESSABLE";
      case 429:
        return "RATE_LIMITED";
      case 503:
        return "SERVICE_UNAVAILABLE";
      default:
        return status >= 500 ? "INTERNAL_ERROR" : "ERROR";
    }
  }
}
