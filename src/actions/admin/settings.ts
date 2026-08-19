"use server";

import { and, count, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/db";
import {
  auditLogs,
  dressCodeColors,
  gifts,
  mediaAssets,
  scheduleItems,
  siteSettings,
  storyMoments
} from "@/db/schema";
import { assertSiteReady, getReadinessChecklist } from "@/lib/admin/readiness";
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";

import {
  type AdminActionResult,
  authorizedAdmin,
  refreshAdmin,
  runAuditedAdminMutation
} from "./shared";

const bankingSchema = z.object({
  accountHolder: z.string().trim().min(1).max(200),
  iban: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, ""))
    .pipe(z.string().min(15).max(34)),
  bankName: z.string().trim().max(200).optional(),
  instructions: z.string().trim().max(500).optional()
});

const settingsSchema = z.object({
  privacyReviewed: z.boolean(),
  requestHoldHours: z.coerce.number().int().min(1).max(168),
  publicContactLabel: z.string().trim().max(120).optional()
});

function encryptionKey() {
  const value = process.env.DATA_ENCRYPTION_KEY?.trim();
  if (!value) throw new Error("DATA_ENCRYPTION_KEY non configurato");
  return value;
}

export async function saveBankingAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await authorizedAdmin("banking.save");
  const parsed = bankingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: "Coordinate bancarie non valide" };
  }
  const encryptedValue = encryptSecret(
    JSON.stringify(parsed.data),
    encryptionKey()
  );
  await runAuditedAdminMutation({
    actorAdminId: admin.id,
    action: "banking.updated",
    targetType: "site_setting",
    metadata: { configured: true },
    mutation: async (tx) => {
      await tx
        .insert(siteSettings)
        .values({
          key: "banking_instructions",
          value: { configured: true },
          encryptedValue
        })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: {
            value: { configured: true },
            encryptedValue,
            updatedAt: new Date()
          }
        });
    }
  });
  await refreshAdmin("/admin/impostazioni");
  return { ok: true, message: "Coordinate salvate" };
}

export async function getBankingAction() {
  await authorizedAdmin("banking.view");
  const rows = await getDatabase()
    .select({ encryptedValue: siteSettings.encryptedValue })
    .from(siteSettings)
    .where(eq(siteSettings.key, "banking_instructions"))
    .limit(1);
  if (!rows[0]?.encryptedValue) return null;
  return bankingSchema.parse(
    JSON.parse(decryptSecret(rows[0].encryptedValue, encryptionKey()))
  );
}

export async function saveAdminSettingsAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await authorizedAdmin("settings.save");
  const parsed = settingsSchema.safeParse({
    privacyReviewed: formData.get("privacyReviewed") === "on",
    requestHoldHours: formData.get("requestHoldHours"),
    publicContactLabel: formData.get("publicContactLabel") || undefined
  });
  if (!parsed.success) return { ok: false, message: "Impostazioni non valide" };
  await runAuditedAdminMutation({
    actorAdminId: admin.id,
    action: "settings.updated",
    targetType: "site_setting",
    metadata: {
      privacyReviewed: parsed.data.privacyReviewed,
      requestHoldHours: parsed.data.requestHoldHours
    },
    mutation: async (tx) => {
      await tx
        .insert(siteSettings)
        .values({ key: "admin_settings", value: parsed.data })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: { value: parsed.data, updatedAt: new Date() }
        });
    }
  });
  await refreshAdmin("/admin/impostazioni");
  return { ok: true, message: "Impostazioni salvate" };
}

export async function loadReadiness() {
  await authorizedAdmin("site.publish");
  const db = getDatabase();
  const [
    settings,
    scheduleCount,
    storyCount,
    colorCount,
    giftCount,
    banking,
    mediaRows
  ] = await Promise.all([
    db.select().from(siteSettings),
    db
      .select({ count: count() })
      .from(scheduleItems)
      .where(
        and(eq(scheduleItems.published, true), isNull(scheduleItems.archivedAt))
      ),
    db
      .select({ count: count() })
      .from(storyMoments)
      .where(
        and(eq(storyMoments.published, true), isNull(storyMoments.archivedAt))
      ),
    db
      .select({ count: count() })
      .from(dressCodeColors)
      .where(isNull(dressCodeColors.archivedAt)),
    db
      .select({ count: count() })
      .from(gifts)
      .where(
        and(
          eq(gifts.published, true),
          eq(gifts.completed, false),
          isNull(gifts.archivedAt)
        )
      ),
    db
      .select({ encryptedValue: siteSettings.encryptedValue })
      .from(siteSettings)
      .where(eq(siteSettings.key, "banking_instructions"))
      .limit(1),
    db
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(isNull(mediaAssets.archivedAt))
  ]);
  const byKey = new Map(
    settings.map((setting) => [setting.key, setting.value])
  );
  const adminSettings = byKey.get("admin_settings") as
    { privacyReviewed?: boolean } | undefined;
  const hero = byKey.get("hero") as { published?: boolean } | undefined;
  const wedding = byKey.get("wedding") as
    { published?: boolean; weddingDate?: string } | undefined;
  const dress = byKey.get("dress_code") as { published?: boolean } | undefined;
  const mediaSettings = byKey.get("media_settings") as
    { requiredMediaIds?: unknown } | undefined;
  const requiredMediaIds = Array.isArray(mediaSettings?.requiredMediaIds)
    ? mediaSettings.requiredMediaIds.filter(
        (id): id is string => typeof id === "string"
      )
    : [];
  const knownMediaIds = new Set(mediaRows.map((row) => row.id));
  return getReadinessChecklist({
    heroConfigured: byKey.has("hero"),
    heroPublished: hero?.published === true,
    weddingConfigured: byKey.has("wedding"),
    weddingPublished: wedding?.published === true,
    weddingDateConfigured: Boolean(wedding?.weddingDate),
    schedulePublishedCount: scheduleCount[0]?.count ?? 0,
    storyPublishedCount: storyCount[0]?.count ?? 0,
    dressColorCount: colorCount[0]?.count ?? 0,
    dressPublished: dress?.published === true,
    publishedGiftCount: giftCount[0]?.count ?? 0,
    bankingConfigured: Boolean(banking[0]?.encryptedValue),
    requiredMediaReady:
      requiredMediaIds.length > 0 &&
      requiredMediaIds.every((id) => knownMediaIds.has(id)),
    privacyReviewed: adminSettings?.privacyReviewed === true
  });
}

export async function publishSiteAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await authorizedAdmin("site.publish");
  if (formData.get("confirmation") !== "PUBBLICA") {
    return { ok: false, message: "Conferma la pubblicazione" };
  }
  const checklist = await loadReadiness();
  assertSiteReady(checklist);
  const published = await getDatabase().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('site_publication'))`
    );
    const current = await tx
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, "site_publication"))
      .limit(1);
    if (
      (current[0]?.value as { published?: boolean } | undefined)?.published ===
      true
    )
      return false;
    const now = new Date();
    await tx
      .insert(siteSettings)
      .values({
        key: "site_publication",
        value: { published: true, publishedAt: now.toISOString() }
      })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: {
          value: { published: true, publishedAt: now.toISOString() },
          updatedAt: now
        }
      });
    await tx.insert(auditLogs).values({
      actorAdminId: admin.id,
      actorType: "admin",
      action: "site.published",
      targetType: "site_publication",
      metadata: {
        readiness: checklist.map(({ key, ready }) => ({ key, ready }))
      }
    });
    return true;
  });
  await refreshAdmin("/admin");
  return {
    ok: true,
    message: published ? "Sito pubblicato" : "Sito già pubblicato"
  };
}

export async function unpublishSiteAction(): Promise<AdminActionResult> {
  const admin = await authorizedAdmin("site.unpublish");
  const unpublished = await getDatabase().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('site_publication'))`
    );
    const current = await tx
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, "site_publication"))
      .limit(1);
    if (
      (current[0]?.value as { published?: boolean } | undefined)?.published ===
      false
    )
      return false;
    await tx
      .insert(siteSettings)
      .values({ key: "site_publication", value: { published: false } })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: { published: false }, updatedAt: new Date() }
      });
    await tx.insert(auditLogs).values({
      actorAdminId: admin.id,
      actorType: "admin",
      action: "site.unpublished",
      targetType: "site_publication",
      metadata: {}
    });
    return true;
  });
  await refreshAdmin("/admin");
  return {
    ok: true,
    message: unpublished
      ? "Pubblicazione revocata"
      : "Pubblicazione già revocata"
  };
}
