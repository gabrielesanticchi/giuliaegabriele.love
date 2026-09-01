import "server-only";

import { and, count, desc, eq, lt, sql } from "drizzle-orm";

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
          and(eq(giftIntents.status, "pending"), lt(giftIntents.expiresAt, now))
        ),
      db
        .select({
          requestedEuros: sql<number>`coalesce(sum(${giftIntents.amountEuros}), 0)`,
          receivedEuros: sql<number>`coalesce(sum(${giftIntents.receivedAmountEuros}), 0)`,
          appliedEuros: sql<number>`coalesce(sum(${giftIntents.appliedAmountEuros}), 0)`
        })
        .from(giftIntents),
      db
        .select({
          id: giftIntents.id,
          reference: giftIntents.publicReference,
          status: giftIntents.status,
          amountEuros: giftIntents.amountEuros,
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
    requestedEuros: Number(valueRows[0]?.requestedEuros ?? 0),
    receivedEuros: Number(valueRows[0]?.receivedEuros ?? 0),
    appliedEuros: Number(valueRows[0]?.appliedEuros ?? 0),
    recent
  };
}
