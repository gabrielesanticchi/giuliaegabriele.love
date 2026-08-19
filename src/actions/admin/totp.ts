"use server";

import { eq, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { z } from "zod";

import { getDatabase } from "@/db";
import { adminUsers, auditLogs } from "@/db/schema";
import { authSecrets } from "@/lib/auth/environment";
import { createTotpEnrollment, verifyTotpCode } from "@/lib/auth/totp";
import { verifyAdminPassword } from "@/lib/auth/password";
import { verifyRecoveryCode } from "@/lib/auth/totp";
import { decryptSecret } from "@/lib/security/crypto";

import { authorizedAdmin } from "./shared";

export type TotpEnrollmentState = {
  ok: boolean;
  message: string;
  qrDataUrl?: string;
  recoveryCodes?: string[];
};

export async function beginTotpEnrollmentAction(): Promise<TotpEnrollmentState> {
  const admin = await authorizedAdmin("totp.enroll");
  const rows = await getDatabase()
    .select({
      emailEncrypted: adminUsers.emailEncrypted,
      totpEnabled: adminUsers.totpEnabled
    })
    .from(adminUsers)
    .where(eq(adminUsers.id, admin.id))
    .limit(1);
  if (!rows[0]) return { ok: false, message: "Account non disponibile" };
  if (rows[0].totpEnabled)
    return { ok: false, message: "TOTP già attivo: usa il reset protetto" };
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
      pendingRecoveryCodeHashes: enrollment.recoveryCodeHashes,
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
  const completed = await getDatabase().transaction(async (tx) => {
    await tx.execute(
      sql`select id from ${adminUsers} where id = ${admin.id} for update`
    );
    const rows = await tx
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, admin.id))
      .limit(1);
    const row = rows[0];
    if (
      !row?.pendingTotpSecretEncrypted ||
      row.pendingRecoveryCodeHashes.length === 0
    )
      return false;
    const valid = await verifyTotpCode({
      code: code.data,
      secretEncrypted: row.pendingTotpSecretEncrypted,
      encryptionKey: authSecrets().encryptionKey
    });
    if (!valid) return false;
    await tx
      .update(adminUsers)
      .set({
        totpSecretEncrypted: row.pendingTotpSecretEncrypted,
        pendingTotpSecretEncrypted: null,
        recoveryCodeHashes: row.pendingRecoveryCodeHashes,
        pendingRecoveryCodeHashes: [],
        totpEnabled: true,
        sessionVersion: row.sessionVersion + 1,
        updatedAt: new Date()
      })
      .where(eq(adminUsers.id, admin.id));
    await tx.insert(auditLogs).values({
      actorAdminId: admin.id,
      actorType: "admin",
      action: "admin.totp_enabled",
      targetType: "admin_user",
      targetId: admin.id,
      metadata: {}
    });
    return true;
  });
  return completed
    ? { ok: true, message: "Autenticazione a due fattori attiva" }
    : { ok: false, message: "Codice non valido" };
}

export async function resetTotpEnrollmentAction(
  formData: FormData
): Promise<TotpEnrollmentState> {
  const admin = await authorizedAdmin("totp.reset-recovery");
  const parsed = z
    .object({ password: z.string().min(1), code: z.string().min(6).max(32) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { ok: false, message: "Verifica recente non valida" };
  const secrets = authSecrets();
  const enrollment = await getDatabase().transaction(async (tx) => {
    await tx.execute(
      sql`select id from ${adminUsers} where id = ${admin.id} for update`
    );
    const rows = await tx
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, admin.id))
      .limit(1);
    const row = rows[0];
    if (
      !row?.totpEnabled ||
      !(await verifyAdminPassword(parsed.data.password, row.passwordHash))
    )
      return null;
    const validTotp = row.totpSecretEncrypted
      ? await verifyTotpCode({
          code: parsed.data.code,
          secretEncrypted: row.totpSecretEncrypted,
          encryptionKey: secrets.encryptionKey
        })
      : false;
    const recovery = verifyRecoveryCode({
      code: parsed.data.code,
      recoveryCodeHashes: row.recoveryCodeHashes,
      recoveryPepper: secrets.recoveryPepper
    });
    if (!validTotp && !recovery.valid) return null;
    const created = createTotpEnrollment({
      email: decryptSecret(row.emailEncrypted, secrets.encryptionKey),
      encryptionKey: secrets.encryptionKey,
      recoveryPepper: secrets.recoveryPepper
    });
    const updated = await tx
      .update(adminUsers)
      .set({
        pendingTotpSecretEncrypted: created.secretEncrypted,
        pendingRecoveryCodeHashes: created.recoveryCodeHashes,
        // A recovery code is consumed under the same row lock as the reset.
        recoveryCodeHashes: validTotp
          ? row.recoveryCodeHashes
          : (recovery.hashes ?? row.recoveryCodeHashes),
        updatedAt: new Date()
      })
      .where(eq(adminUsers.id, admin.id))
      .returning({ id: adminUsers.id });
    if (!updated[0]) throw new Error("Account non aggiornato");
    await tx.insert(auditLogs).values({
      actorAdminId: admin.id,
      actorType: "admin",
      action: "admin.totp_reset_started",
      targetType: "admin_user",
      targetId: admin.id,
      metadata: { recoveryCodeUsed: !validTotp }
    });
    return created;
  });
  if (!enrollment) return { ok: false, message: "Verifica recente non valida" };
  return {
    ok: true,
    message: "Nuova configurazione pronta",
    qrDataUrl: await QRCode.toDataURL(enrollment.uri),
    recoveryCodes: enrollment.recoveryCodes
  };
}
