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
import type { ApiErrorResponse } from "@aurahire/shared";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<FastifyReply>();
    const req = ctx.getRequest<FastifyRequest & { id?: string }>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_ERROR";
    let message = "Something went wrong";
    let errors: ApiErrorResponse["errors"] = undefined;

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
        code = (body.code as string | undefined) ?? this.codeFromStatus(statusCode);
        message = (body.message as string | undefined) ?? exception.message;
        if (Array.isArray(body.errors)) {
          errors = body.errors as ApiErrorResponse["errors"];
        }
      } else {
        code = this.codeFromStatus(statusCode);
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
      this.logger.error(`Unhandled error: ${exception.stack ?? exception.message}`);
    } else {
      this.logger.error(`Unknown exception: ${JSON.stringify(exception)}`);
    }

    const body: ApiErrorResponse = {
      statusCode,
      code,
      message,
      ...(errors ? { errors } : {}),
      timestamp: new Date().toISOString(),
      path: req.url,
      requestId: req.id ?? "unknown",
    };

    void res.status(statusCode).send(body);
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
