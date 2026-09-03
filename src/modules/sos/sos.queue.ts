import { Queue } from "bullmq";
import { createQueueConnection } from "@/queues/connection";

export const SOS_QUEUE_NAME = "sos-broadcast";

export interface SosJobData {
  sosEventId: string;
  memberId: string;
  triggeredByName: string;
  /** True for the follow-up "video is now available" notification, rather than the initial trigger one. */
  videoAttached?: boolean;
}

/**
 * Dedicated queue, kept separate from `push-notifications` so bulk notification
 * volume can never delay an SOS delivery (FR-SOS-02: <=5s, >=99.5% success).
 */
export const sosQueue = new Queue<SosJobData>(SOS_QUEUE_NAME, {
  connection: createQueueConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export function enqueueSosNotification(data: SosJobData) {
  return sosQueue.add("notify", data, { priority: 1 });
}
