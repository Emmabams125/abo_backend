import { Queue } from "bullmq";
import { createQueueConnection } from "@/queues/connection";
import type { PushMessage } from "@/notifications/push-provider.interface";

export const PUSH_QUEUE_NAME = "push-notifications";

export interface PushJobData {
  userId: string;
  message: PushMessage;
}

export const pushQueue = new Queue<PushJobData>(PUSH_QUEUE_NAME, {
  connection: createQueueConnection(),
  defaultJobOptions: {
    attempts: 4,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export function enqueuePush(data: PushJobData) {
  return pushQueue.add("send", data);
}
