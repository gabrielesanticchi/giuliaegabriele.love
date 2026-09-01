import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";
import type { PublicContent } from "@/data/demo-content";
import { getDatabase } from "@/db";
import {
  dressCodeColors,
  giftCategories,
  giftIntents,
  giftLocks,
  gifts,
  mediaAssets,
  scheduleItems,
  siteSettings,
  storyMoments
} from "@/db/schema";
import { getPublicGiftStatus } from "@/lib/domain/gifts";
import { isSafeMediaUrl } from "@/lib/domain/urls";

type Snapshot = {
  published: boolean;
  requiredMediaReady: boolean;
  operationalReady: boolean;
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
    mediaUrl?: string | null;
    mediaAlt?: string | null;
  }>;
  colors: Array<{ name: string; hexColor: string; sortOrder: number }>;
  gifts: Array<{
    id: string;
    title: string;
    description: string | null;
    priceEuros: number;
    progressMode: string;
    completed: boolean;
    published: boolean;
    archivedAt: Date | null;
    sortOrder: number;
    categoryName: string | null;
    hasLock: boolean;
    verifiedEuros: number;
    pendingEuros: number;
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
    !wedding.weddingDate ||
    (!includeDrafts &&
      (!snapshot.requiredMediaReady ||
        !snapshot.operationalReady ||
        snapshot.schedule.every((item) => !item.published) ||
        snapshot.story.every((item) => !item.published) ||
        snapshot.colors.length === 0 ||
        snapshot.gifts.every(
          (gift) =>
            !gift.published || gift.archivedAt !== null || gift.completed
        )))
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
      ? wedding.locations.flatMap((raw) => {
          const location = object(raw);
          if (
            (location.kind !== "ceremony" && location.kind !== "reception") ||
            typeof location.name !== "string" ||
            typeof location.address !== "string" ||
            typeof location.time !== "string" ||
            typeof location.mapsUrl !== "string" ||
            !location.mapsUrl.startsWith("https://")
          )
            return [];
          return [
            {
              kind: location.kind,
              name: location.name,
              place: location.address,
              address: location.address,
              time: location.time,
              note:
                typeof location.parking === "string" ? location.parking : "",
              mapsUrl: location.mapsUrl
            }
          ];
        })
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
        description: item.body,
        media:
          typeof item.mediaUrl === "string" && isSafeMediaUrl(item.mediaUrl)
            ? {
                url: item.mediaUrl,
                alt: item.mediaAlt ?? "",
                focalPoint: { x: 50, y: 50 }
              }
            : null
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
        priceEuros: gift.priceEuros,
        status: getPublicGiftStatus({
          completed: gift.completed || gift.verifiedEuros >= gift.priceEuros,
          hasFullGiftLock: gift.hasLock
        }),
        allowFullGift: true,
        allowContributions: true,
        contributionMinimumEuros: 25,
        confirmedContributionEuros: gift.verifiedEuros,
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
    db
      .select()
      .from(scheduleItems)
      .where(isNull(scheduleItems.archivedAt))
      .orderBy(asc(scheduleItems.sortOrder)),
    db
      .select({
        id: storyMoments.id,
        title: storyMoments.title,
        body: storyMoments.body,
        sortOrder: storyMoments.sortOrder,
        published: storyMoments.published,
        mediaUrl: mediaAssets.pathname,
        mediaAlt: mediaAssets.altText
      })
      .from(storyMoments)
      .leftJoin(
        mediaAssets,
        and(
          eq(storyMoments.mediaAssetId, mediaAssets.id),
          isNull(mediaAssets.archivedAt)
        )
      )
      .where(isNull(storyMoments.archivedAt))
      .orderBy(asc(storyMoments.sortOrder)),
    db
      .select()
      .from(dressCodeColors)
      .where(isNull(dressCodeColors.archivedAt))
      .orderBy(asc(dressCodeColors.sortOrder)),
    db
      .select({
        id: gifts.id,
        title: gifts.title,
        description: gifts.description,
        priceEuros: gifts.priceEuros,
        progressMode: gifts.progressMode,
        completed: gifts.completed,
        published: gifts.published,
        archivedAt: gifts.archivedAt,
        sortOrder: gifts.sortOrder,
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
        kind: giftIntents.kind,
        status: giftIntents.status,
        amountEuros: giftIntents.amountEuros,
        appliedAmountEuros: giftIntents.appliedAmountEuros,
        expiresAt: giftIntents.expiresAt
      })
      .from(giftIntents)
  ]);
  const settings = Object.fromEntries(
    settingsRows.map((row) => [row.key, row.value])
  );
  const publication = object(settings.site_publication);
  const adminSettings = object(settings.admin_settings);
  const mediaSettings = object(settings.media_settings);
  const requiredMediaIds = Array.isArray(mediaSettings.requiredMediaIds)
    ? mediaSettings.requiredMediaIds.filter(
        (id): id is string => typeof id === "string"
      )
    : [];
  const mediaIdRows = await db
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(isNull(mediaAssets.archivedAt));
  const knownMediaIds = new Set(mediaIdRows.map((row) => row.id));
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
        .reduce((sum, intent) => sum + intent.appliedAmountEuros, 0),
      pendingEuros: intents
        .filter(
          (intent) =>
            intent.kind === "contribution" &&
            intent.status === "pending" &&
            intent.expiresAt > now
        )
        .reduce((sum, intent) => sum + intent.amountEuros, 0)
    };
  });
  return mapPublicContentSnapshot(
    {
      published: publication.published === true,
      requiredMediaReady:
        requiredMediaIds.length > 0 &&
        requiredMediaIds.every((id) => knownMediaIds.has(id)),
      operationalReady:
        adminSettings.privacyReviewed === true &&
        settingsRows.some(
          (row) =>
            row.key === "banking_instructions" && Boolean(row.encryptedValue)
        ),
      settings,
      schedule,
      story,
      colors,
      gifts: mappedGifts
    },
    options.includeDrafts === true
  );
}

/** Fail closed at the public boundary: an unavailable database is unpublished. */
export async function loadPublicContentSafely(
  loader: () => Promise<PublicContent | null> = loadPublicContent
): Promise<PublicContent | null> {
  try {
    return await loader();
  } catch {
    return null;
  }
}
