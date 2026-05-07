import { Global, Module } from "@nestjs/common";

import { RealtimeGateway } from "./realtime.gateway";
import { EventsService } from "./events.service";
import { WsJwtUtil } from "./ws-jwt.util";

/**
 * Global module — feature modules inject `EventsService` without importing
 * this module explicitly. `DRIZZLE_CLIENT` and `ConfigService` come from the
 * already-global `DbModule` and `ConfigModule.forRoot({ isGlobal: true })`.
 */
@Global()
@Module({
  providers: [RealtimeGateway, EventsService, WsJwtUtil],
  exports: [EventsService],
})
export class RealtimeModule {}
