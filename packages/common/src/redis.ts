import { logger } from "@webcampus/common/logger";
import Redis from "ioredis";

const globalForRedis = global as unknown as { redis: Redis };

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redis =
  globalForRedis.redis ||
  new Redis(REDIS_URL, {
    // Recommended options for robustness
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    // Do not open a socket until the first command. CLI scripts that import
    // this client (or auth, which uses it) without issuing commands must exit
    // cleanly; an eager connection would keep the Node event loop alive.
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

redis.on("connect", () => {
  logger.info("Redis client connected successfully");
});

redis.on("error", (err) => {
  logger.error(
    "Redis client error:",
    err as unknown as Record<string, unknown>
  );
});
