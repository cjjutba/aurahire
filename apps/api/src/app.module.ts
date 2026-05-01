import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { singleLine: true, translateTime: "SYS:HH:MM:ss" } }
          : undefined,
        level: process.env.LOG_LEVEL ?? "info",
        autoLogging: true,
        redact: ["req.headers.authorization", "req.headers.cookie"],
      },
    }),
    HealthModule,
  ],
})
export class AppModule {}
