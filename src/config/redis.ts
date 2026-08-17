import IORedis from "ioredis";
import { env } from "@/config/env";

/** Shared connection factory. BullMQ requires maxRetriesPerRequest: null on its connections. */
export function createRedisConnection(): IORedis {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}

export const redis = createRedisConnection();
