import { Queue } from "bullmq";
import { createQueueConnection } from "@/queues/connection";

export const LOCATION_SHARE_QUEUE_NAME = "location-share-expiry";

export interface LocationShareExpiryJobData {
  messageId: string;
  conversationId: string;
  senderId: string;
}

export const locationShareQueue = new Queue<LocationShareExpiryJobData>(LOCATION_SHARE_QUEUE_NAME, {
  connection: createQueueConnection(),
  defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
});

/** FR-MSG-03: schedules the auto-expiry + both-parties notification for a timed location share. */
export function scheduleLocationShareExpiry(data: LocationShareExpiryJobData, expiresAt: Date) {
  const delay = Math.max(0, expiresAt.getTime() - Date.now());
  return locationShareQueue.add("expire", data, { delay });
}
