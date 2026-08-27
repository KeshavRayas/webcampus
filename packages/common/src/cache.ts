import { logger } from "./logger";
import { redis } from "./redis";

const DEFAULT_JITTER = 0.2;

/**
 * Adds ±`jitter` randomized variance to a base TTL (in seconds).
 * Prevents a "thundering herd" of keys expiring simultaneously.
 */
function withJitter(ttlSeconds: number, jitter: number): number {
  const variance = ttlSeconds * jitter;
  const delta = (Math.random() * 2 - 1) * variance;
  return Math.max(1, Math.round(ttlSeconds + delta));
}

/**
 * Look-aside cache: returns the cached value for `key`, or loads it via
 * `loader` on a miss and hydrates the cache with a jittered TTL.
 */
export async function getOrSet<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
  options?: { jitter?: number }
): Promise<T> {
  const jitter = options?.jitter ?? DEFAULT_JITTER;

  const cached = await redis.get(key);
  if (cached != null) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      // Corrupt entry — fall through and rehydrate.
    }
  }

  const value = await loader();
  if (value == null) return value;

  const ttl = withJitter(ttlSeconds, jitter);
  await redis
    .set(key, JSON.stringify(value), "EX", ttl)
    .catch((err) => logger.warn("cache set failed", { key, err: String(err) }));
  return value;
}

/**
 * Deletes every key starting with `prefix` (SCAN-based, non-blocking).
 * Used to invalidate cached data on the writes that change it.
 */
export async function invalidatePrefix(prefix: string): Promise<void> {
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      `${prefix}*`,
      "COUNT",
      100
    );
    cursor = nextCursor;
    if (keys.length > 0) await redis.del(...keys);
  } while (cursor !== "0");
}

export function del(key: string): Promise<number> {
  return redis.del(key);
}
