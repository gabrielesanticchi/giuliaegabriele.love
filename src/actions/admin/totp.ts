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
    if (!row) return { error: "Account non disponibile" } as const;
    if (row.totpEnabled)
      return { error: "TOTP già attivo: usa il reset protetto" } as const;
    if (row.pendingTotpSecretEncrypted)
      return { error: "Configurazione TOTP già in corso" } as const;
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
        updatedAt: new Date()
      })
      .where(eq(adminUsers.id, admin.id))
      .returning({ id: adminUsers.id });
    if (!updated[0]) throw new Error("Account non aggiornato");
    await tx.insert(auditLogs).values({
      actorAdminId: admin.id,
      actorType: "admin",
      action: "admin.totp_enrollment_started",
      targetType: "admin_user",
      targetId: admin.id,
      metadata: {}
    });
    return { created } as const;
  });
  if ("error" in enrollment)
    return { ok: false, message: enrollment.error ?? "Errore TOTP" };
  return {
    ok: true,
    message: "Scansiona il QR e conserva i codici in un luogo sicuro",
    qrDataUrl: await QRCode.toDataURL(enrollment.created.uri, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 280
    }),
    recoveryCodes: enrollment.created.recoveryCodes
  };
}

/**
 * Recovers a stuck onboarding: a not-yet-enabled admin that lost the QR/recovery
 * response can restart enrollment. Serialized under the row lock and audited, it
 * atomically replaces the pending secret and pending recovery codes and returns
 * a fresh QR plus one-time recovery codes. It never touches the active TOTP
 * credentials of an already-enabled account.
 */
export async function restartTotpEnrollmentAction(): Promise<TotpEnrollmentState> {
  const admin = await authorizedAdmin("totp.enroll");
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
    if (!row) return { error: "Account non disponibile" } as const;
    if (row.totpEnabled)
      return { error: "TOTP già attivo: usa il reset protetto" } as const;
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
        updatedAt: new Date()
      })
      .where(eq(adminUsers.id, admin.id))
      .returning({ id: adminUsers.id });
    if (!updated[0]) throw new Error("Account non aggiornato");
    await tx.insert(auditLogs).values({
      actorAdminId: admin.id,
      actorType: "admin",
      action: "admin.totp_enrollment_restarted",
      targetType: "admin_user",
      targetId: admin.id,
      metadata: {}
    });
    return { created } as const;
  });
  if ("error" in enrollment)
    return { ok: false, message: enrollment.error ?? "Errore TOTP" };
  return {
    ok: true,
    message: "Nuova configurazione pronta: scansiona il QR e salva i codici",
    qrDataUrl: await QRCode.toDataURL(enrollment.created.uri, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 280
    }),
    recoveryCodes: enrollment.created.recoveryCodes
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
        // Non bumpare sessionVersion: attivare il TOTP non deve invalidare la
        // sessione corrente dell'admin (totpPending diventa false da solo).
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
