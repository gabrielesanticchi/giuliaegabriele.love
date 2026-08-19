"use server";

import { and, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/db";
import {
  dressCodeColors,
  gifts,
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
  writeAdminAudit
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
  await getDatabase()
    .insert(siteSettings)
    .values({
      key: "banking_instructions",
      value: { configured: true },
      encryptedValue: encryptSecret(
        JSON.stringify(parsed.data),
        encryptionKey()
      )
    })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: {
        value: { configured: true },
        encryptedValue: encryptSecret(
          JSON.stringify(parsed.data),
          encryptionKey()
        ),
        updatedAt: new Date()
      }
    });
  await writeAdminAudit({
    actorAdminId: admin.id,
    action: "banking.updated",
    targetType: "site_setting",
    metadata: { configured: true }
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
  await getDatabase()
    .insert(siteSettings)
    .values({ key: "admin_settings", value: parsed.data })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value: parsed.data, updatedAt: new Date() }
    });
  await writeAdminAudit({
    actorAdminId: admin.id,
    action: "settings.updated",
    targetType: "site_setting",
    metadata: {
      privacyReviewed: parsed.data.privacyReviewed,
      requestHoldHours: parsed.data.requestHoldHours
    }
  });
  await refreshAdmin("/admin/impostazioni");
  return { ok: true, message: "Impostazioni salvate" };
}

export async function loadReadiness() {
  await authorizedAdmin("site.publish");
  const db = getDatabase();
  const [settings, scheduleCount, storyCount, colorCount, giftCount, banking] =
    await Promise.all([
      db.select().from(siteSettings),
      db
        .select({ count: count() })
        .from(scheduleItems)
        .where(eq(scheduleItems.published, true)),
      db
        .select({ count: count() })
        .from(storyMoments)
        .where(eq(storyMoments.published, true)),
      db.select({ count: count() }).from(dressCodeColors),
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
        .limit(1)
    ]);
  const byKey = new Map(
    settings.map((setting) => [setting.key, setting.value])
  );
  const adminSettings = byKey.get("admin_settings") as
    { privacyReviewed?: boolean } | undefined;
  return getReadinessChecklist({
    heroConfigured: byKey.has("hero"),
    weddingConfigured: byKey.has("wedding"),
    schedulePublishedCount: scheduleCount[0]?.count ?? 0,
    storyPublishedCount: storyCount[0]?.count ?? 0,
    dressColorCount: colorCount[0]?.count ?? 0,
    publishedGiftCount: giftCount[0]?.count ?? 0,
    bankingConfigured: Boolean(banking[0]?.encryptedValue),
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
  await getDatabase()
    .insert(siteSettings)
    .values({
      key: "site_publication",
      value: { published: true, publishedAt: new Date().toISOString() }
    })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: {
        value: { published: true, publishedAt: new Date().toISOString() },
        updatedAt: new Date()
      }
    });
  await writeAdminAudit({
    actorAdminId: admin.id,
    action: "site.published",
    targetType: "site_publication",
    metadata: { readiness: checklist.map(({ key, ready }) => ({ key, ready })) }
  });
  await refreshAdmin("/admin");
  return { ok: true, message: "Sito pubblicato" };
}

export async function unpublishSiteAction(): Promise<AdminActionResult> {
  const admin = await authorizedAdmin("site.unpublish");
  await getDatabase()
    .insert(siteSettings)
    .values({ key: "site_publication", value: { published: false } })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value: { published: false }, updatedAt: new Date() }
    });
  await writeAdminAudit({
    actorAdminId: admin.id,
    action: "site.unpublished",
    targetType: "site_publication"
  });
  await refreshAdmin("/admin");
  return { ok: true, message: "Pubblicazione revocata" };
}
