import { Global, Logger, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";

import {
  MATCH_PREVIEW_PRECOMPUTE_QUEUE,
  RESCORE_BATCH_QUEUE,
} from "./queue.constants";
import { MatchPreviewQueueService } from "./match-preview-queue.service";

const logger = new Logger("QueueModule");

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>("REDIS_URL") ?? "redis://localhost:6379";
        logger.log(`BullMQ root: connecting to Redis at ${url}`);
        return {
          connection: { url },
          defaultJobOptions: {
            attempts: 1,
            removeOnComplete: { age: 86400 },
            removeOnFail: { age: 7 * 86400 },
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: RESCORE_BATCH_QUEUE,
    }),
    BullModule.registerQueue({
      name: MATCH_PREVIEW_PRECOMPUTE_QUEUE,
    }),
  ],
  providers: [MatchPreviewQueueService],
  exports: [BullModule, MatchPreviewQueueService],
})
export class QueueModule {}
