/**
 * Generate the OpenAPI 3 spec from the NestJS controllers and write it to
 * packages/shared/openapi.json for orval consumption.
 *
 * Run: pnpm --filter @aurahire/api generate:openapi
 */
import "reflect-metadata";

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { VersioningType } from "@nestjs/common";

import { AppModule } from "../src/app.module";

async function main() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { logger: false, abortOnError: false },
  );

  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  const config = new DocumentBuilder()
    .setTitle("AuraHire API")
    .setDescription(
      "Backend API for AuraHire - Explainable + Fair AI-Powered Recruitment",
    )
    .setVersion("0.1.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" })
    .addServer("http://localhost:3333", "Local")
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outPath = resolve(__dirname, "../../../packages/shared/openapi.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(document, null, 2), "utf8");
  // eslint-disable-next-line no-console
  console.log(`OpenAPI spec written to ${outPath}`);

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`generate-openapi failed: ${err?.stack ?? err}\n`);
  process.exit(1);
});
