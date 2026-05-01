import { Controller, Get, Version, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Controller("health")
export class HealthController {
  @Get()
  @Version(VERSION_NEUTRAL)
  @ApiOperation({ summary: "Service health check" })
  @ApiResponse({ status: 200, description: "Service is healthy" })
  check(): { status: "ok"; uptime: number; version: string; timestamp: string } {
    return {
      status: "ok",
      uptime: process.uptime(),
      version: process.env.APP_VERSION ?? "0.1.0",
      timestamp: new Date().toISOString(),
    };
  }
}
