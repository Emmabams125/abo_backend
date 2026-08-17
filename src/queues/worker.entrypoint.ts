import { logger } from "@/common/utils/logger";
import { startPushWorker } from "@/queues/push.worker";
import { startSosWorker } from "@/modules/sos/sos.worker";
import { startLocationShareWorker } from "@/modules/messages/location-share.worker";
import { startDowngradeWorker } from "@/modules/subscription/downgrade.worker";

startPushWorker();
startSosWorker();
startLocationShareWorker();
startDowngradeWorker();

logger.info("Queue workers started (push-notifications, sos-broadcast, location-share-expiry, subscription-downgrade)");
