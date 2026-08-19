import "server-only";

import { count, desc, eq, lt, or, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import { giftIntents, gifts } from "@/db/schema";

export async function loadDashboardSummary() {
  const db = getDatabase();
  const now = new Date();
  const [giftRows, intentRows, expiredRows, valueRows, recent] =
    await Promise.all([
      db.select({ count: count() }).from(gifts),
      db.select({ count: count() }).from(giftIntents),
      db
        .select({ count: count() })
        .from(giftIntents)
        .where(
          or(eq(giftIntents.status, "expired"), lt(giftIntents.expiresAt, now))
        ),
      db
        .select({
          requestedCents: sql<number>`coalesce(sum(${giftIntents.amountCents}), 0)`,
          receivedCents: sql<number>`coalesce(sum(${giftIntents.receivedAmountCents}), 0)`,
          appliedCents: sql<number>`coalesce(sum(${giftIntents.appliedAmountCents}), 0)`
        })
        .from(giftIntents),
      db
        .select({
          id: giftIntents.id,
          reference: giftIntents.publicReference,
          status: giftIntents.status,
          amountCents: giftIntents.amountCents,
          createdAt: giftIntents.createdAt
        })
        .from(giftIntents)
        .orderBy(desc(giftIntents.createdAt))
        .limit(8)
    ]);
  return {
    giftCount: giftRows[0]?.count ?? 0,
    intentCount: intentRows[0]?.count ?? 0,
    expiredCount: expiredRows[0]?.count ?? 0,
    requestedCents: Number(valueRows[0]?.requestedCents ?? 0),
    receivedCents: Number(valueRows[0]?.receivedCents ?? 0),
    appliedCents: Number(valueRows[0]?.appliedCents ?? 0),
    recent
  };
}
