"use server";

import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/db";
import { giftCategories, gifts } from "@/db/schema";

import {
  type AdminActionResult,
  authorizedAdmin,
  refreshAdmin,
  runAuditedAdminMutation
} from "./shared";

const categorySchema = z.object({
  id: z.uuid().optional(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(100),
  name: z.string().trim().min(1).max(150),
  sortOrder: z.coerce.number().int().min(0)
});

const giftSchema = z.object({
  id: z.uuid().optional(),
  publicReference: z.string().trim().min(3).max(80),
  categoryId: z.uuid().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2_000).optional(),
  priceCents: z.coerce.number().int().min(0).max(100_000_000),
  progressMode: z.enum(["hidden", "discreet", "exact"]),
  sortOrder: z.coerce.number().int().min(0),
  published: z.boolean()
});

export async function saveGiftCategoryAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await authorizedAdmin("gift-category.save");
  const parsed = categorySchema.safeParse({
    id: formData.get("id") || undefined,
    slug: formData.get("slug"),
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder") ?? 0
  });
  if (!parsed.success) return { ok: false, message: "Categoria non valida" };
  const { id = randomUUID(), ...values } = parsed.data;
  await runAuditedAdminMutation({
    actorAdminId: admin.id,
    action: "gift_category.saved",
    targetType: "gift_category",
    targetId: id,
    metadata: { slug: values.slug, sortOrder: values.sortOrder },
    mutation: async (tx) => {
      await tx
        .insert(giftCategories)
        .values({ id, ...values })
        .onConflictDoUpdate({
          target: giftCategories.id,
          set: { ...values, updatedAt: new Date() }
        });
    }
  });
  await refreshAdmin("/admin/regali");
  return { ok: true, message: "Categoria salvata" };
}

export async function archiveGiftCategoryAction(id: string) {
  const admin = await authorizedAdmin("gift-category.save");
  const categoryId = z.uuid().parse(id);
  await runAuditedAdminMutation({
    actorAdminId: admin.id,
    action: "gift_category.archived",
    targetType: "gift_category",
    targetId: categoryId,
    mutation: async (tx) => {
      await tx
        .update(giftCategories)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(giftCategories.id, categoryId));
    }
  });
  await refreshAdmin("/admin/regali");
}

export async function saveGiftAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await authorizedAdmin("gift.save");
  const parsed = giftSchema.safeParse({
    id: formData.get("id") || undefined,
    publicReference: formData.get("publicReference"),
    categoryId: formData.get("categoryId") || undefined,
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    priceCents: formData.get("priceCents"),
    progressMode: formData.get("progressMode"),
    sortOrder: formData.get("sortOrder") ?? 0,
    published: formData.get("published") === "on"
  });
  if (!parsed.success) return { ok: false, message: "Regalo non valido" };
  const { id = randomUUID(), ...values } = parsed.data;
  await runAuditedAdminMutation({
    actorAdminId: admin.id,
    action: "gift.saved",
    targetType: "gift",
    targetId: id,
    metadata: {
      priceCents: values.priceCents,
      published: values.published,
      sortOrder: values.sortOrder
    },
    mutation: async (tx) => {
      await tx
        .insert(gifts)
        .values({ id, ...values })
        .onConflictDoUpdate({
          target: gifts.id,
          set: { ...values, updatedAt: new Date() }
        });
    }
  });
  await refreshAdmin("/admin/regali");
  return { ok: true, message: "Regalo salvato" };
}

export async function duplicateGiftAction(id: string) {
  const admin = await authorizedAdmin("gift.duplicate");
  const giftId = z.uuid().parse(id);
  const source = await getDatabase()
    .select()
    .from(gifts)
    .where(eq(gifts.id, giftId))
    .limit(1);
  if (!source[0]) throw new Error("Regalo non trovato");
  const duplicateId = randomUUID();
  await runAuditedAdminMutation({
    actorAdminId: admin.id,
    action: "gift.duplicated",
    targetType: "gift",
    targetId: duplicateId,
    metadata: { sourceId: giftId },
    mutation: async (tx) => {
      await tx.insert(gifts).values({
        ...source[0],
        id: duplicateId,
        publicReference: `G-${randomUUID()}`,
        title: `${source[0].title} (copia)`,
        published: false,
        completed: false,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  });
  await refreshAdmin("/admin/regali");
}

export async function archiveGiftAction(id: string) {
  const admin = await authorizedAdmin("gift.archive");
  const giftId = z.uuid().parse(id);
  await runAuditedAdminMutation({
    actorAdminId: admin.id,
    action: "gift.archived",
    targetType: "gift",
    targetId: giftId,
    mutation: async (tx) => {
      await tx
        .update(gifts)
        .set({
          archivedAt: new Date(),
          published: false,
          updatedAt: new Date()
        })
        .where(eq(gifts.id, giftId));
    }
  });
  await refreshAdmin("/admin/regali");
}

export async function setGiftPublishedAction(id: string, published: boolean) {
  const admin = await authorizedAdmin(published ? "gift.publish" : "gift.hide");
  const giftId = z.uuid().parse(id);
  await runAuditedAdminMutation({
    actorAdminId: admin.id,
    action: published ? "gift.published" : "gift.hidden",
    targetType: "gift",
    targetId: giftId,
    mutation: async (tx) => {
      await tx
        .update(gifts)
        .set({ published, archivedAt: null, updatedAt: new Date() })
        .where(eq(gifts.id, giftId));
    }
  });
  await refreshAdmin("/admin/regali");
}

export async function reorderGiftsAction(orderedIds: string[]) {
  const admin = await authorizedAdmin("gift.reorder");
  const ids = z.array(z.uuid()).min(1).max(500).parse(orderedIds);
  await runAuditedAdminMutation({
    actorAdminId: admin.id,
    action: "gift.reordered",
    targetType: "gift_collection",
    metadata: { count: ids.length },
    mutation: async (tx) => {
      for (const [sortOrder, id] of ids.entries()) {
        await tx
          .update(gifts)
          .set({ sortOrder, updatedAt: new Date() })
          .where(eq(gifts.id, id));
      }
    }
  });
  await refreshAdmin("/admin/regali");
}

export async function nextGiftSortOrder() {
  await authorizedAdmin("gift.save");
  const rows = await getDatabase()
    .select({ value: sql<number>`coalesce(max(${gifts.sortOrder}), -1) + 1` })
    .from(gifts);
  return Number(rows[0]?.value ?? 0);
}
