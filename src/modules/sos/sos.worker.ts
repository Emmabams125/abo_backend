import { Worker } from "bullmq";
import { createQueueConnection } from "@/queues/connection";
import { logger } from "@/common/utils/logger";
import { prisma } from "@/db/prisma.client";
import { pushService } from "@/notifications/push.service";
import { sosRepository } from "@/modules/sos/sos.repository";
import { SOS_QUEUE_NAME, type SosJobData } from "@/modules/sos/sos.queue";

export function startSosWorker(): Worker<SosJobData> {
  const worker = new Worker<SosJobData>(
    SOS_QUEUE_NAME,
    async (job) => {
      const { sosEventId, memberId, triggeredByName } = job.data;

      const devices = await prisma.device.findMany({
        where: { userId: memberId, pushToken: { not: null } },
      });

      if (devices.length === 0) {
        // No registered device to push to — leave PENDING so a later retry (once a device
        // registers) or manual investigation can pick it up; don't mark FAILED prematurely.
        return;
      }

      let anySucceeded = false;
      for (const device of devices) {
        const result = await pushService.sendToDevice(device.platform, device.pushToken!, {
          title: "🚨 Emergency SOS",
          body: `${triggeredByName} triggered an SOS alert. Tap to view their location.`,
          data: { type: "sos", sosEventId },
        });
        if (result.success) anySucceeded = true;
      }

      await sosRepository.updateNotificationStatus(sosEventId, memberId, anySucceeded ? "DELIVERED" : "FAILED");

      if (!anySucceeded) {
        throw new Error("All device push attempts failed for this member — will retry with backoff");
      }
    },
    { connection: createQueueConnection(), concurrency: 20 }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    logger.error({ jobId: job.id, sosEventId: job.data.sosEventId, err }, "sos-broadcast job failed");
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await sosRepository.updateNotificationStatus(job.data.sosEventId, job.data.memberId, "FAILED");
    }
  });

  return worker;
}
