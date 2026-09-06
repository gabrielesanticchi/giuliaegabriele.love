import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import type { PublicGift } from "@/data/site-content";
import { getDatabase } from "@/db";
import { giftCategories, giftIntents, giftLocks, gifts } from "@/db/schema";
import { getPublicGiftStatus } from "@/lib/domain/gifts";

type DatabaseGift = {
  id: string;
  title: string;
  description: string | null;
  priceEuros: number;
  completed: boolean;
  published: boolean;
  archivedAt: Date | null;
  categoryName: string | null;
  hasLock: boolean;
  verifiedEuros: number;
};

type GiftSnapshot = {
  gifts: DatabaseGift[];
};

export function mapPublicGifts(snapshot: GiftSnapshot): PublicGift[] {
  return snapshot.gifts
    .filter((gift) => gift.archivedAt === null && gift.published)
    .map((gift) => ({
      id: gift.id,
      category: gift.categoryName ?? "Lista nozze",
      name: gift.title,
      description: gift.description ?? "",
      priceEuros: gift.priceEuros,
      status: getPublicGiftStatus({
        completed: gift.completed || gift.verifiedEuros >= gift.priceEuros,
        hasFullGiftLock: gift.hasLock
      }),
      allowFullGift: true,
      allowContributions: true,
      confirmedContributionEuros: gift.verifiedEuros
    }));
}

export async function loadPublicGifts(): Promise<PublicGift[]> {
  const db = getDatabase();
  const [giftRows, lockRows, intentRows] = await Promise.all([
    db
      .select({
        id: gifts.id,
        title: gifts.title,
        description: gifts.description,
        priceEuros: gifts.priceEuros,
        completed: gifts.completed,
        published: gifts.published,
        archivedAt: gifts.archivedAt,
        categoryName: giftCategories.name
      })
      .from(gifts)
      .leftJoin(
        giftCategories,
        and(
          eq(gifts.categoryId, giftCategories.id),
          isNull(giftCategories.archivedAt)
        )
      )
      .orderBy(asc(gifts.sortOrder)),
    db.select().from(giftLocks),
    db
      .select({
        giftId: giftIntents.giftId,
        status: giftIntents.status,
        appliedAmountEuros: giftIntents.appliedAmountEuros
      })
      .from(giftIntents)
  ]);
  const now = new Date();
  const mappedGifts = giftRows.map((gift) => {
    const intents = intentRows.filter((intent) => intent.giftId === gift.id);
    return {
      ...gift,
      hasLock: lockRows.some(
        (lock) => lock.giftId === gift.id && lock.expiresAt > now
      ),
      verifiedEuros: intents
        .filter((intent) => intent.status === "verified")
        .reduce((sum, intent) => sum + intent.appliedAmountEuros, 0)
    };
  });
  return mapPublicGifts({ gifts: mappedGifts });
}

/** Keep code-owned wedding details visible during a transient database error. */
export async function loadPublicGiftsSafely(
  loader: () => Promise<PublicGift[]> = loadPublicGifts
): Promise<PublicGift[]> {
  try {
    return await loader();
  } catch {
    return [];
  }
}
