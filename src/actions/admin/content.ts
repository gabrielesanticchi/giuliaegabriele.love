"use server";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  dressCodeColors,
  mediaAssets,
  scheduleItems,
  siteSettings,
  storyMoments
} from "@/db/schema";

import {
  type AdminActionResult,
  authorizedAdmin,
  refreshAdmin,
  runAuditedAdminMutation
} from "./shared";

const settingSchema = z.object({
  key: z.enum([
    "hero",
    "wedding",
    "dress_code",
    "gift_settings",
    "media_settings"
  ]),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000),
  weddingDate: z.string().datetime({ offset: true }).optional(),
  displayDate: z.string().trim().max(100).optional(),
  place: z.string().trim().max(200).optional(),
  requiredMediaIds: z.array(z.uuid()).max(100).optional(),
  published: z.boolean()
});

const scheduleSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000).optional(),
  locationName: z.string().trim().max(200).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional(),
  sortOrder: z.coerce.number().int().min(0),
  published: z.boolean()
});

const storySchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4_000),
  occurredOn: z.coerce.date().optional(),
  sortOrder: z.coerce.number().int().min(0),
  published: z.boolean()
});

const dressColorSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(80),
  hexColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  sortOrder: z.coerce.number().int().min(0)
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

export async function saveScheduleItemAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await authorizedAdmin("schedule.save");
  const parsed = scheduleSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    locationName: formData.get("locationName") || undefined,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt") || undefined,
    sortOrder: formData.get("sortOrder") ?? 0,
    published: bool(formData.get("published"))
  });
  if (!parsed.success) return { ok: false, message: "Evento non valido" };
  const { id = randomUUID(), ...values } = parsed.data;
  await runAuditedAdminMutation({
    actorAdminId: admin.id,
    action: "schedule.saved",
    targetType: "schedule_item",
    targetId: id,
    metadata: { published: values.published, sortOrder: values.sortOrder },
    mutation: async (tx) => {
      await tx
        .insert(scheduleItems)
        .values({ id, ...values })
        .onConflictDoUpdate({
          target: scheduleItems.id,
          set: { ...values, updatedAt: new Date() }
        });
    }
  });
  await refreshAdmin("/admin/programma");
  return { ok: true, message: "Evento salvato" };
}

export async function deleteScheduleItemAction(id: string) {
  const admin = await authorizedAdmin("schedule.delete");
  const parsedId = z.uuid().parse(id);
  await runAuditedAdminMutation({
    actorAdminId: admin.id,
    action: "schedule.deleted",
    targetType: "schedule_item",
    targetId: parsedId,
    mutation: async (tx) => {
      await tx
        .update(scheduleItems)
        .set({
          archivedAt: new Date(),
          published: false,
          updatedAt: new Date()
        })
        .where(eq(scheduleItems.id, parsedId));
    }
  });
  await refreshAdmin("/admin/programma");
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
    sortOrder: formData.get("sortOrder") ?? 0,
    published: bool(formData.get("published"))
  });
  if (!parsed.success) return { ok: false, message: "Momento non valido" };
  const { id = randomUUID(), ...values } = parsed.data;
  await runAuditedAdminMutation({
    actorAdminId: admin.id,
    action: "story.saved",
    targetType: "story_moment",
    targetId: id,
    metadata: { published: values.published, sortOrder: values.sortOrder },
    mutation: async (tx) => {
      await tx
        .insert(storyMoments)
        .values({ id, ...values })
        .onConflictDoUpdate({
          target: storyMoments.id,
          set: { ...values, updatedAt: new Date() }
        });
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
      await tx
        .update(storyMoments)
        .set({
          archivedAt: new Date(),
          published: false,
          updatedAt: new Date()
        })
        .where(eq(storyMoments.id, parsedId));
    }
  });
  await refreshAdmin("/admin/storia");
}

export async function saveDressColorAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await authorizedAdmin("dress-code.save");
  const parsed = dressColorSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    hexColor: formData.get("hexColor"),
    sortOrder: formData.get("sortOrder") ?? 0
  });
  if (!parsed.success) return { ok: false, message: "Colore non valido" };
  const { id = randomUUID(), ...values } = parsed.data;
  await runAuditedAdminMutation({
    actorAdminId: admin.id,
    action: "dress_code.saved",
    targetType: "dress_code_color",
    targetId: id,
    metadata: { name: values.name, sortOrder: values.sortOrder },
    mutation: async (tx) => {
      await tx
        .insert(dressCodeColors)
        .values({ id, ...values })
        .onConflictDoUpdate({
          target: dressCodeColors.id,
          set: { ...values, updatedAt: new Date() }
        });
    }
  });
  await refreshAdmin("/admin/dress-code");
  return { ok: true, message: "Colore salvato" };
}

export async function deleteDressColorAction(id: string) {
  const admin = await authorizedAdmin("dress-code.save");
  const parsedId = z.uuid().parse(id);
  await runAuditedAdminMutation({
    actorAdminId: admin.id,
    action: "dress_code.deleted",
    targetType: "dress_code_color",
    targetId: parsedId,
    mutation: async (tx) => {
      await tx
        .update(dressCodeColors)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(dressCodeColors.id, parsedId));
    }
  });
  await refreshAdmin("/admin/dress-code");
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
      await tx
        .insert(mediaAssets)
        .values({ id, ...values })
        .onConflictDoUpdate({
          target: mediaAssets.id,
          set: { ...values, updatedAt: new Date() }
        });
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
      await tx
        .update(mediaAssets)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(mediaAssets.id, parsedId));
    }
  });
  await refreshAdmin("/admin/media");
}
