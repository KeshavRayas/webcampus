import { backendEnv } from "@webcampus/common/env";
import Redis from "ioredis";

const env = backendEnv();

// Initialize the Redis client using the environment variable validated by Zod
export const redis = new Redis(env.REDIS_URL, {
  // Recommended options for robustness
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on("connect", () => {
  console.log("Redis client connected successfully");
});

redis.on("error", (err) => {
  console.error("Redis client error:", err);
});
