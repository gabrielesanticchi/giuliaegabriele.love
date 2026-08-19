"use server";

import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { z } from "zod";

import { getDatabase } from "@/db";
import { adminUsers } from "@/db/schema";
import { authSecrets } from "@/lib/auth/environment";
import { createTotpEnrollment, verifyTotpCode } from "@/lib/auth/totp";
import { decryptSecret } from "@/lib/security/crypto";

import { authorizedAdmin, writeAdminAudit } from "./shared";

export type TotpEnrollmentState = {
  ok: boolean;
  message: string;
  qrDataUrl?: string;
  recoveryCodes?: string[];
};

export async function beginTotpEnrollmentAction(): Promise<TotpEnrollmentState> {
  const admin = await authorizedAdmin("totp.enroll");
  const rows = await getDatabase()
    .select({ emailEncrypted: adminUsers.emailEncrypted })
    .from(adminUsers)
    .where(eq(adminUsers.id, admin.id))
    .limit(1);
  if (!rows[0]) return { ok: false, message: "Account non disponibile" };
  const secrets = authSecrets();
  const email = decryptSecret(rows[0].emailEncrypted, secrets.encryptionKey);
  const enrollment = createTotpEnrollment({
    email,
    encryptionKey: secrets.encryptionKey,
    recoveryPepper: secrets.recoveryPepper
  });
  await getDatabase()
    .update(adminUsers)
    .set({
      pendingTotpSecretEncrypted: enrollment.secretEncrypted,
      recoveryCodeHashes: enrollment.recoveryCodeHashes,
      updatedAt: new Date()
    })
    .where(eq(adminUsers.id, admin.id));
  return {
    ok: true,
    message: "Scansiona il QR e conserva i codici in un luogo sicuro",
    qrDataUrl: await QRCode.toDataURL(enrollment.uri, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 280
    }),
    recoveryCodes: enrollment.recoveryCodes
  };
}

export async function completeTotpEnrollmentAction(
  _previous: TotpEnrollmentState,
  formData: FormData
): Promise<TotpEnrollmentState> {
  const admin = await authorizedAdmin("totp.enroll");
  const code = z
    .string()
    .regex(/^\d{6}$/)
    .safeParse(formData.get("code"));
  if (!code.success) return { ok: false, message: "Codice non valido" };
  const rows = await getDatabase()
    .select({ pending: adminUsers.pendingTotpSecretEncrypted })
    .from(adminUsers)
    .where(eq(adminUsers.id, admin.id))
    .limit(1);
  const pending = rows[0]?.pending;
  if (!pending) return { ok: false, message: "Avvia prima la configurazione" };
  const valid = await verifyTotpCode({
    code: code.data,
    secretEncrypted: pending,
    encryptionKey: authSecrets().encryptionKey
  });
  if (!valid) return { ok: false, message: "Codice non valido" };
  await getDatabase()
    .update(adminUsers)
    .set({
      totpSecretEncrypted: pending,
      pendingTotpSecretEncrypted: null,
      totpEnabled: true,
      sessionVersion: admin.sessionVersion + 1,
      updatedAt: new Date()
    })
    .where(eq(adminUsers.id, admin.id));
  await writeAdminAudit({
    actorAdminId: admin.id,
    action: "admin.totp_enabled",
    targetType: "admin_user",
    targetId: admin.id
  });
  return { ok: true, message: "Autenticazione a due fattori attiva" };
}
