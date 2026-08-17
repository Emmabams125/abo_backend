import { Queue } from "bullmq";
import { createQueueConnection } from "@/queues/connection";

export const DOWNGRADE_QUEUE_NAME = "subscription-downgrade";

export interface DowngradeJobData {
  circleId: string;
}

export const downgradeQueue = new Queue<DowngradeJobData>(DOWNGRADE_QUEUE_NAME, {
  connection: createQueueConnection(),
  defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
});

/** FR-SUB-02: downgrade takes effect at the end of the current billing period, not immediately. */
export function scheduleDowngrade(circleId: string, effectiveAt: Date) {
  const delay = Math.max(0, effectiveAt.getTime() - Date.now());
  return downgradeQueue.add("apply-downgrade", { circleId }, { delay, jobId: `downgrade:${circleId}` });
}

export function cancelScheduledDowngrade(circleId: string) {
  return downgradeQueue.remove(`downgrade:${circleId}`);
}
