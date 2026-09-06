"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/db";
import { siteSettings } from "@/db/schema";
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
