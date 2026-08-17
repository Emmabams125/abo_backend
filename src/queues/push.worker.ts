import { Worker } from "bullmq";
import { createQueueConnection } from "@/queues/connection";
import { logger } from "@/common/utils/logger";
import { prisma } from "@/db/prisma.client";
import { pushService } from "@/notifications/push.service";
import { PUSH_QUEUE_NAME, type PushJobData } from "@/queues/push.queue";

export function startPushWorker(): Worker<PushJobData> {
  const worker = new Worker<PushJobData>(
    PUSH_QUEUE_NAME,
    async (job) => {
      const devices = await prisma.device.findMany({
        where: { userId: job.data.userId, pushToken: { not: null } },
      });

      for (const device of devices) {
        const result = await pushService.sendToDevice(device.platform, device.pushToken!, job.data.message);
        if (!result.success) {
          logger.warn({ deviceId: device.id, error: result.error }, "Push delivery failed for device");
        }
      }
    },
    { connection: createQueueConnection(), concurrency: 10 }
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "push-notifications job failed after all retries");
  });

  return worker;
}
