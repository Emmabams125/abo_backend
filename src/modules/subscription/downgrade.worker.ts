import { Worker } from "bullmq";
import { createQueueConnection } from "@/queues/connection";
import { subscriptionRepository } from "@/modules/subscription/subscription.repository";
import { DOWNGRADE_QUEUE_NAME, type DowngradeJobData } from "@/modules/subscription/downgrade.queue";

export function startDowngradeWorker(): Worker<DowngradeJobData> {
  return new Worker<DowngradeJobData>(
    DOWNGRADE_QUEUE_NAME,
    async (job) => {
      await subscriptionRepository.applyPendingDowngrade(job.data.circleId);
    },
    { connection: createQueueConnection(), concurrency: 5 }
  );
}
