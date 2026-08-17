import { createRedisConnection } from "@/config/redis";

/** BullMQ requires its own dedicated connection(s) — don't share the app's general-purpose redis client. */
export function createQueueConnection() {
  return createRedisConnection();
}
