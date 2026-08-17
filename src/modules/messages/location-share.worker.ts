import { Worker } from "bullmq";
import { createQueueConnection } from "@/queues/connection";
import { messagesService } from "@/modules/messages/messages.service";
import {
  LOCATION_SHARE_QUEUE_NAME,
  type LocationShareExpiryJobData,
} from "@/modules/messages/location-share.queue";

export function startLocationShareWorker(): Worker<LocationShareExpiryJobData> {
  return new Worker<LocationShareExpiryJobData>(
    LOCATION_SHARE_QUEUE_NAME,
    async (job) => {
      await messagesService.expireLocationShare(job.data.messageId);
    },
    { connection: createQueueConnection(), concurrency: 10 }
  );
}
