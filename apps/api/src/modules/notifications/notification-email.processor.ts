import { Processor, WorkerHost } from "@nestjs/bullmq";
import { NOTIFICATION_EMAIL_QUEUE } from "./queues";

@Processor(NOTIFICATION_EMAIL_QUEUE)
export class NotificationEmailProcessor extends WorkerHost {
  async process(): Promise<void> {
    return;
  }
}
