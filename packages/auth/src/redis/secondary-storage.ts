import { redis } from "@webcampus/common/redis";
import type { SecondaryStorage } from "better-auth";

/**
 * Namespace prefix for all better-auth keys so they never collide with
 * application cache keys (`cache:*`).
 */
const PREFIX = "ba:";

const keyFor = (key: string): string => `${PREFIX}${key}`;

// Atomic GET + DEL via Lua script (single round-trip)
const LUA_GET_AND_DELETE = `
local val = redis.call('GET', KEYS[1])
if val then
  redis.call('DEL', KEYS[1])
end
return val
`;

/**
 * Redis-backed secondary storage for better-auth.
 * Caches sessions and stores rate-limit counters atomically.
 */
export const secondaryStorage: SecondaryStorage = {
  async get(key) {
    return redis.get(keyFor(key));
  },
  async getAndDelete(key) {
    const result = (await redis.eval(LUA_GET_AND_DELETE, 1, keyFor(key))) as
      | string
      | null;
    return result;
  },
  async increment(key, ttl) {
    const fullKey = keyFor(key);
    const count = await redis.incr(fullKey);
    if (count === 1) await redis.expire(fullKey, ttl);
    return count;
  },
  async set(key, value, ttl) {
    const fullKey = keyFor(key);
    if (ttl != null) await redis.set(fullKey, value, "EX", ttl);
    else await redis.set(fullKey, value);
  },
  async delete(key) {
    await redis.del(keyFor(key));
  },
};
