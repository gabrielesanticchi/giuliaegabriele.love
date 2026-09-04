"use server";

import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { mediaAssets, siteSettings, storyMoments } from "@/db/schema";

import {
  type AdminActionResult,
  authorizedAdmin,
  refreshAdmin,
  runAuditedAdminMutation
} from "./shared";

const settingSchema = z.object({
  key: z.enum(["hero", "wedding", "gift_settings", "media_settings"]),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000),
  weddingDate: z.string().datetime({ offset: true }).optional(),
  displayDate: z.string().trim().max(100).optional(),
  place: z.string().trim().max(200).optional(),
  locations: z
    .array(
      z.object({
        kind: z.enum(["ceremony", "reception"]),
        name: z.string().trim().min(1).max(200),
        address: z.string().trim().min(1).max(300),
        time: z.string().trim().min(1).max(100),
        parking: z.string().trim().max(500).optional(),
        mapsUrl: z.url().refine((value) => new URL(value).protocol === "https:")
      })
    )
    .length(2)
    .optional(),
  requiredMediaIds: z.array(z.uuid()).max(100).optional(),
  published: z.boolean()
});

const storySchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4_000),
  occurredOn: z.coerce.date().optional(),
  mediaAssetId: z.uuid().optional(),
  sortOrder: z.coerce.number().int().min(0),
  published: z.boolean()
});

const mediaSchema = z.object({
  id: z.uuid().optional(),
  pathname: z.string().trim().min(1).max(2_000),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4"]),
  sizeBytes: z.coerce
    .number()
    .int()
    .min(0)
    .max(100 * 1024 * 1024),
  altText: z.string().trim().min(1).max(300)
});

function bool(value: FormDataEntryValue | null) {
  return value === "true" || value === "on";
}

export async function saveStructuredContentAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await authorizedAdmin("content.save");
  const parsed = settingSchema.safeParse({
    key: formData.get("key"),
    title: formData.get("title"),
    description: formData.get("description"),
    weddingDate: formData.get("weddingDate") || undefined,
    displayDate: formData.get("displayDate") || undefined,
    place: formData.get("place") || undefined,
    locations:
      formData.get("key") === "wedding"
        ? (["ceremony", "reception"] as const).map((kind) => ({
            kind,
            name: formData.get(`${kind}Name`),
            address: formData.get(`${kind}Address`),
            time: formData.get(`${kind}Time`),
            parking: formData.get(`${kind}Parking`) || undefined,
            mapsUrl: formData.get(`${kind}MapsUrl`)
          }))
        : undefined,
    requiredMediaIds: String(formData.get("requiredMediaIds") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    published: bool(formData.get("published"))
  });
  if (!parsed.success) return { ok: false, message: "Contenuto non valido" };
  await runAuditedAdminMutation({
    actorAdminId: admin.id,
    action: "content.saved",
    targetType: "site_setting",
    metadata: { key: parsed.data.key, published: parsed.data.published },
    mutation: async (tx) => {
      await tx
        .insert(siteSettings)
        .values({
          key: parsed.data.key,
          value:
            parsed.data.key === "hero"
              ? {
                  ...parsed.data,
                  media: { kind: "art", label: parsed.data.title }
                }
              : parsed.data
        })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: {
            value:
              parsed.data.key === "hero"
                ? {
                    ...parsed.data,
                    media: { kind: "art", label: parsed.data.title }
                  }
                : parsed.data,
            updatedAt: new Date()
          }
        });
    }
  });
  await refreshAdmin("/admin");
  return { ok: true, message: "Contenuto salvato" };
}

export async function saveStoryMomentAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await authorizedAdmin("story.save");
  const parsed = storySchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    body: formData.get("body"),
    occurredOn: formData.get("occurredOn") || undefined,
    mediaAssetId: formData.get("mediaAssetId") || undefined,
    sortOrder: formData.get("sortOrder") ?? 0,
    published: bool(formData.get("published"))
  });
  if (!parsed.success) return { ok: false, message: "Momento non valido" };
  const existingId = parsed.data.id;
  const { id = randomUUID(), ...values } = parsed.data;
  await runAuditedAdminMutation({
    actorAdminId: admin.id,
    action: "story.saved",
    targetType: "story_moment",
    targetId: id,
    metadata: { published: values.published, sortOrder: values.sortOrder },
    mutation: async (tx) => {
      if (values.mediaAssetId) {
        const asset = await tx
          .select({ id: mediaAssets.id })
          .from(mediaAssets)
          .where(
            and(
              eq(mediaAssets.id, values.mediaAssetId),
              isNull(mediaAssets.archivedAt)
            )
          )
          .limit(1);
        if (!asset[0]) throw new Error("Media non valido");
      }
      if (existingId) {
        const updated = await tx
          .update(storyMoments)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(storyMoments.id, existingId))
          .returning({ id: storyMoments.id });
        if (!updated[0]) throw new Error("Momento non trovato");
      } else await tx.insert(storyMoments).values({ id, ...values });
    }
  });
  await refreshAdmin("/admin/storia");
  return { ok: true, message: "Momento salvato" };
}

export async function deleteStoryMomentAction(id: string) {
  const admin = await authorizedAdmin("story.delete");
  const parsedId = z.uuid().parse(id);
  await runAuditedAdminMutation({
    actorAdminId: admin.id,
    action: "story.deleted",
    targetType: "story_moment",
    targetId: parsedId,
    mutation: async (tx) => {
      const updated = await tx
        .update(storyMoments)
        .set({
          archivedAt: new Date(),
          published: false,
          updatedAt: new Date()
        })
        .where(eq(storyMoments.id, parsedId))
        .returning({ id: storyMoments.id });
      if (!updated[0]) throw new Error("Momento non trovato");
    }
  });
  await refreshAdmin("/admin/storia");
}

export async function saveMediaMetadataAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await authorizedAdmin("media.save");
  const parsed = mediaSchema.safeParse({
    id: formData.get("id") || undefined,
    pathname: formData.get("pathname"),
    contentType: formData.get("contentType"),
    sizeBytes: formData.get("sizeBytes"),
    altText: formData.get("altText")
  });
  if (!parsed.success) return { ok: false, message: "Media non valido" };
  const existingId = parsed.data.id;
  const { id = randomUUID(), ...values } = parsed.data;
  await runAuditedAdminMutation({
    actorAdminId: admin.id,
    action: "media.metadata_saved",
    targetType: "media_asset",
    targetId: id,
    metadata: {
      contentType: values.contentType,
      sizeBytes: values.sizeBytes
    },
    mutation: async (tx) => {
      if (existingId) {
        const updated = await tx
          .update(mediaAssets)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(mediaAssets.id, existingId))
          .returning({ id: mediaAssets.id });
        if (!updated[0]) throw new Error("Media non trovato");
      } else await tx.insert(mediaAssets).values({ id, ...values });
    }
  });
  await refreshAdmin("/admin/media");
  return { ok: true, message: "Media salvato" };
}

export async function deleteMediaMetadataAction(id: string) {
  const admin = await authorizedAdmin("media.save");
  const parsedId = z.uuid().parse(id);
  await runAuditedAdminMutation({
    actorAdminId: admin.id,
    action: "media.deleted",
    targetType: "media_asset",
    targetId: parsedId,
    mutation: async (tx) => {
      const updated = await tx
        .update(mediaAssets)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(mediaAssets.id, parsedId))
        .returning({ id: mediaAssets.id });
      if (!updated[0]) throw new Error("Media non trovato");
    }
  });
  await refreshAdmin("/admin/media");
}
