import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { VersioningType } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { ZodValidationPipe } from "nestjs-zod";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";

import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false, genReqId: () => undefined as unknown as string }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [`'self'`],
        styleSrc: [`'self'`, `'unsafe-inline'`],
        imgSrc: [`'self'`, "data:", "validator.swagger.io"],
        scriptSrc: [`'self'`, `https: 'unsafe-inline'`],
      },
    },
  });

  // Multipart (for resume upload)
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 1,
      fieldNameSize: 100,
      fieldSize: 1024,
    },
  });

  // CORS
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim());
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
  });

  // Global prefix + versioning
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  // Global Zod validation pipe (replaces basic ValidationPipe from Slice 1.1)
  app.useGlobalPipes(new ZodValidationPipe());

  // Global exception filter — normalizes errors to standard envelope
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger
  const config = new DocumentBuilder()
    .setTitle("AuraHire API")
    .setDescription(
      "Backend API for AuraHire — Explainable + Fair AI-Powered Recruitment",
    )
    .setVersion("0.1.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port, "0.0.0.0");

  // eslint-disable-next-line no-console
  console.log(`AuraHire API running at http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger UI at http://localhost:${port}/api/docs`);
}

void bootstrap();
