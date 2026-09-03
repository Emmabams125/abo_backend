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
      const { sosEventId, memberId, triggeredByName, videoAttached } = job.data;

      const devices = await prisma.device.findMany({
        where: { userId: memberId, pushToken: { not: null } },
      });

      if (devices.length === 0) {
        // No registered device to push to — leave PENDING so a later retry (once a device
        // registers) or manual investigation can pick it up; don't mark FAILED prematurely.
        return;
      }

      const notification = videoAttached
        ? {
            title: "🎥 SOS video available",
            body: `A video from ${triggeredByName}'s SOS is now available.`,
          }
        : {
            title: "🚨 Emergency SOS",
            body: `${triggeredByName} triggered an SOS alert. Tap to view their location.`,
          };

      let anySucceeded = false;
      for (const device of devices) {
        const result = await pushService.sendToDevice(device.platform, device.pushToken!, {
          ...notification,
          data: { type: "sos", sosEventId },
        });
        if (result.success) anySucceeded = true;
      }

      // SOSNotification's (sosEventId, memberId) row tracks the *trigger*
      // broadcast specifically (FR-SOS-03's immutable log) — a video-attached
      // job shares that same key but is a distinct, later notification, so it
      // must not overwrite that record. BullMQ's own attempts/backoff (see
      // sos.queue.ts) is sufficient retry tracking for this one.
      if (!videoAttached) {
        await sosRepository.updateNotificationStatus(sosEventId, memberId, anySucceeded ? "DELIVERED" : "FAILED");
      }

      if (!anySucceeded) {
        throw new Error("All device push attempts failed for this member — will retry with backoff");
      }
    },
    { connection: createQueueConnection(), concurrency: 20 }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    logger.error({ jobId: job.id, sosEventId: job.data.sosEventId, err }, "sos-broadcast job failed");
    if (!job.data.videoAttached && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await sosRepository.updateNotificationStatus(job.data.sosEventId, job.data.memberId, "FAILED");
    }
  });

  return worker;
}
