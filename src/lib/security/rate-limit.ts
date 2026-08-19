import "server-only";

import { sql } from "drizzle-orm";

import type { WeddingDatabase } from "@/db";
import { rateLimitBuckets } from "@/db/schema";

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function getRateLimitDecision(input: {
  count: number;
  limit: number;
  now: Date;
  expiresAt: Date;
}): RateLimitDecision {
  const allowed = input.count <= input.limit;
  return {
    allowed,
    remaining: Math.max(0, input.limit - input.count),
    retryAfterSeconds: allowed
      ? 0
      : Math.max(
          0,
          Math.ceil((input.expiresAt.getTime() - input.now.getTime()) / 1000)
        )
  };
}

export async function consumeRateLimit(
  db: WeddingDatabase,
  input: {
    fingerprintHash: string;
    bucketKey: string;
    limit: number;
    windowMs: number;
    now?: Date;
  }
): Promise<RateLimitDecision> {
  if (!Number.isSafeInteger(input.limit) || input.limit < 1) {
    throw new TypeError("limit deve essere un intero positivo");
  }
  if (!Number.isSafeInteger(input.windowMs) || input.windowMs < 1) {
    throw new TypeError("windowMs deve essere un intero positivo");
  }

  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + input.windowMs);
  const result = await db
    .insert(rateLimitBuckets)
    .values({
      fingerprintHash: input.fingerprintHash,
      bucketKey: input.bucketKey,
      count: 1,
      windowStartedAt: now,
      expiresAt,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: [rateLimitBuckets.fingerprintHash, rateLimitBuckets.bucketKey],
      set: {
        count: sql`case when ${rateLimitBuckets.expiresAt} <= ${now} then 1 else ${rateLimitBuckets.count} + 1 end`,
        windowStartedAt: sql`case when ${rateLimitBuckets.expiresAt} <= ${now} then ${now} else ${rateLimitBuckets.windowStartedAt} end`,
        expiresAt: sql`case when ${rateLimitBuckets.expiresAt} <= ${now} then ${expiresAt} else ${rateLimitBuckets.expiresAt} end`,
        updatedAt: now
      }
    })
    .returning({
      count: rateLimitBuckets.count,
      expiresAt: rateLimitBuckets.expiresAt
    });

  const bucket = result[0];
  if (!bucket) throw new Error("Impossibile aggiornare il rate limit");
  return getRateLimitDecision({
    count: bucket.count,
    limit: input.limit,
    now,
    expiresAt: bucket.expiresAt
  });
}
