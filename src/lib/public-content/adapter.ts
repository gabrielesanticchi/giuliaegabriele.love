import "server-only";

import { asc, eq } from "drizzle-orm";
import type { PublicContent } from "@/data/demo-content";
import { getDatabase } from "@/db";
import {
  dressCodeColors,
  giftCategories,
  giftIntents,
  giftLocks,
  gifts,
  scheduleItems,
  siteSettings,
  storyMoments
} from "@/db/schema";
import { getPublicGiftStatus } from "@/lib/domain/gifts";

type Snapshot = {
  published: boolean;
  settings: Record<string, unknown>;
  schedule: Array<{
    id: string;
    title: string;
    description: string | null;
    startsAt: Date;
    sortOrder: number;
    published: boolean;
  }>;
  story: Array<{
    id: string;
    title: string;
    body: string;
    sortOrder: number;
    published: boolean;
  }>;
  colors: Array<{ name: string; hexColor: string; sortOrder: number }>;
  gifts: Array<{
    id: string;
    title: string;
    description: string | null;
    priceCents: number;
    progressMode: string;
    completed: boolean;
    published: boolean;
    archivedAt: Date | null;
    sortOrder: number;
    categoryName: string | null;
    hasLock: boolean;
    verifiedCents: number;
    pendingCents: number;
  }>;
};

function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export function mapPublicContentSnapshot(
  snapshot: Snapshot,
  includeDrafts: boolean
): PublicContent | null {
  if (!includeDrafts && !snapshot.published) return null;
  const hero = object(snapshot.settings.hero);
  const wedding = object(snapshot.settings.wedding);
  const dress = object(snapshot.settings.dress_code);
  if (
    (!includeDrafts &&
      (hero.published !== true ||
        wedding.published !== true ||
        dress.published !== true)) ||
    !wedding.weddingDate
  )
    return null;
  const media = object(hero.media);
  const heroMedia: PublicContent["heroMedia"] =
    media.kind === "image" && typeof media.src === "string"
      ? {
          kind: "image",
          src: media.src,
          alt: String(media.alt ?? ""),
          focalPoint: { x: 50, y: 50 }
        }
      : {
          kind: "art",
          label:
            typeof media.label === "string" ? media.label : "Bosco editoriale"
        };
  return {
    heroMedia,
    weddingDate: String(wedding.weddingDate),
    displayDate:
      typeof wedding.displayDate === "string" ? wedding.displayDate : null,
    place: typeof wedding.place === "string" ? wedding.place : "",
    locations: Array.isArray(wedding.locations)
      ? (wedding.locations as PublicContent["locations"])
      : [],
    schedule: snapshot.schedule
      .filter((item) => includeDrafts || item.published)
      .map((item) => ({
        time: item.startsAt.toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Rome"
        }),
        dateTime: item.startsAt.toISOString(),
        title: item.title,
        description: item.description ?? ""
      })),
    story: snapshot.story
      .filter((item) => includeDrafts || item.published)
      .map((item, index) => ({
        marker: String(index + 1).padStart(2, "0"),
        title: item.title,
        description: item.body
      })),
    dressCode: {
      name: String(dress.name ?? dress.title ?? ""),
      description: String(dress.description ?? ""),
      note: String(dress.note ?? ""),
      colors: snapshot.colors.map((color) => ({
        name: color.name,
        value: color.hexColor
      }))
    },
    gifts: snapshot.gifts
      .filter(
        (gift) => gift.archivedAt === null && (includeDrafts || gift.published)
      )
      .map((gift) => ({
        id: gift.id,
        category: gift.categoryName ?? "Lista nozze",
        room: gift.categoryName ?? "La nostra casa",
        name: gift.title,
        description: gift.description ?? "",
        priceCents: gift.priceCents,
        status: getPublicGiftStatus({
          completed: gift.completed || gift.verifiedCents >= gift.priceCents,
          hasFullGiftLock: gift.hasLock
        }),
        allowFullGift: true,
        allowContributions: true,
        contributionMinimumCents: 2500,
        confirmedContributionCents: gift.verifiedCents,
        discreetProgress: gift.progressMode !== "exact"
      }))
  };
}

export async function loadPublicContent(
  options: { includeDrafts?: boolean } = {}
): Promise<PublicContent | null> {
  if (!process.env.DATABASE_URL) return null;
  const db = getDatabase();
  const [
    settingsRows,
    schedule,
    story,
    colors,
    giftRows,
    lockRows,
    intentRows
  ] = await Promise.all([
    db.select().from(siteSettings),
    db.select().from(scheduleItems).orderBy(asc(scheduleItems.sortOrder)),
    db.select().from(storyMoments).orderBy(asc(storyMoments.sortOrder)),
    db.select().from(dressCodeColors).orderBy(asc(dressCodeColors.sortOrder)),
    db
      .select({
        id: gifts.id,
        title: gifts.title,
        description: gifts.description,
        priceCents: gifts.priceCents,
        progressMode: gifts.progressMode,
        completed: gifts.completed,
        published: gifts.published,
        archivedAt: gifts.archivedAt,
        sortOrder: gifts.sortOrder,
        categoryName: giftCategories.name
      })
      .from(gifts)
      .leftJoin(giftCategories, eq(gifts.categoryId, giftCategories.id))
      .orderBy(asc(gifts.sortOrder)),
    db.select().from(giftLocks),
    db
      .select({
        giftId: giftIntents.giftId,
        kind: giftIntents.kind,
        status: giftIntents.status,
        amountCents: giftIntents.amountCents,
        appliedAmountCents: giftIntents.appliedAmountCents,
        expiresAt: giftIntents.expiresAt
      })
      .from(giftIntents)
  ]);
  const settings = Object.fromEntries(
    settingsRows.map((row) => [row.key, row.value])
  );
  const publication = object(settings.site_publication);
  const now = new Date();
  const mappedGifts = giftRows.map((gift) => {
    const intents = intentRows.filter((intent) => intent.giftId === gift.id);
    return {
      ...gift,
      hasLock: lockRows.some(
        (lock) => lock.giftId === gift.id && lock.expiresAt > now
      ),
      verifiedCents: intents
        .filter((intent) => intent.status === "verified")
        .reduce((sum, intent) => sum + intent.appliedAmountCents, 0),
      pendingCents: intents
        .filter(
          (intent) =>
            intent.kind === "contribution" &&
            intent.status === "pending" &&
            intent.expiresAt > now
        )
        .reduce((sum, intent) => sum + intent.amountCents, 0)
    };
  });
  return mapPublicContentSnapshot(
    {
      published: publication.published === true,
      settings,
      schedule,
      story,
      colors,
      gifts: mappedGifts
    },
    options.includeDrafts === true
  );
}
