import { redis } from "@webcampus/common/redis";
import { secondaryStorage } from "./secondary-storage";

const PREFIX = "ba:";

const sessionTokenKey = (token: string): string => `${PREFIX}${token}`;
const activeSessionsKey = (userId: string): string =>
  `${PREFIX}active-sessions-${userId}`;

/**
 * Removes every cached session for a user from Redis.
 *
 * better-auth stores sessions in secondary storage under two key shapes:
 *  - `ba:active-sessions-<userId>`  -> JSON array of `{ token, expiresAt }`
 *  - `ba:<token>`                   -> the cached session payload
 *
 * Call this after a user's role/permissions change so the next request
 * re-reads from the database instead of serving a stale cached role.
 */
export async function invalidateUserSessions(userId: string): Promise<void> {
  const listKey = activeSessionsKey(userId);
  const listRaw = await redis.get(listKey);
  if (listRaw) {
    try {
      const sessions = JSON.parse(listRaw) as Array<{ token?: string }>;
      const tokens = sessions
        .map((s) => s.token)
        .filter((t): t is string => typeof t === "string" && t.length > 0);
      if (tokens.length > 0) {
        await redis.del(...tokens.map(sessionTokenKey));
      }
    } catch {
      // Corrupt list — just drop the list itself below.
    }
  }
  await redis.del(listKey);
  // Force secondaryStorage to stay consistent if it has a local cache of
  // the same keys (no-op here, kept for future-proofing).
  await secondaryStorage.delete(`active-sessions-${userId}`);
}
