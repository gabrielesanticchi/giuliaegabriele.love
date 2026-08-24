import "server-only";

import { createInterface } from "node:readline";
import { Writable } from "node:stream";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/db";
import { adminUsers, auditLogs } from "@/db/schema";
import { encryptSecret, decryptSecret } from "@/lib/security/crypto";
import { hashEmail } from "@/lib/security/hashing";

import { authSecrets } from "./environment";
import { hashAdminPassword } from "./password";
import { createRecoveryCodes } from "./totp";

export type AdminCliArgs = {
  email?: string;
  role: "owner" | "editor";
  passwordStdin: boolean;
  resetRecovery: boolean;
};

export function parseAdminCliArgs(args: string[]): AdminCliArgs {
  if (
    args.includes("--password") ||
    args.some((arg) => arg.startsWith("--password="))
  ) {
    throw new Error("La password non può essere passata come argomento");
  }
  const result: AdminCliArgs = {
    role: "editor",
    passwordStdin: args.includes("--password-stdin"),
    resetRecovery: args.includes("--reset-recovery")
  };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--email")
      result.email = args[index + 1]?.trim().toLowerCase();
    if (args[index] === "--role") {
      const role = args[index + 1];
      if (role !== "owner" && role !== "editor")
        throw new Error("Ruolo non valido");
      result.role = role;
    }
  }
  if (result.email) z.email().parse(result.email);
  return result;
}

async function stdinSecret(): Promise<string> {
  let value = "";
  for await (const chunk of process.stdin) value += String(chunk);
  return value.replace(/[\r\n]+$/, "");
}

async function hiddenSecret(prompt: string): Promise<string> {
  if (!process.stdin.isTTY)
    throw new Error("Usa --password-stdin in modalità non interattiva");
  const muted = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    }
  });
  const input = createInterface({
    input: process.stdin,
    output: muted,
    terminal: true
  });
  process.stdout.write(prompt);
  const answer = await new Promise<string>((resolve) =>
    input.question("", resolve)
  );
  muted.end();
  input.close();
  process.stdout.write("\n");
  return answer;
}

export async function readAdminPassword(args: AdminCliArgs): Promise<string> {
  // `--password-stdin` reads until EOF: on an interactive TTY with nothing
  // piped it would hang forever. Fail fast with a usage hint instead.
  if (args.passwordStdin && process.stdin.isTTY) {
    throw new Error(
      "Con --password-stdin passa la password via pipe, es.: " +
        "printf 'password' | pnpm admin:create ... --password-stdin. " +
        "Per l'inserimento interattivo ometti --password-stdin."
    );
  }
  const password = args.passwordStdin
    ? await stdinSecret()
    : await hiddenSecret("Password: ");
  if (!password) throw new Error("Password obbligatoria");
  return password;
}

export async function createAdminAccount(input: {
  email: string;
  role: "owner" | "editor";
  password: string;
}) {
  const secrets = authSecrets();
  const passwordHash = await hashAdminPassword(input.password);
  return getDatabase().transaction(async (tx) => {
    const inserted = await tx
      .insert(adminUsers)
      .values({
        emailHash: hashEmail(input.email, secrets.hmacPepper),
        emailEncrypted: encryptSecret(
          input.email.toLowerCase(),
          secrets.encryptionKey
        ),
        passwordHash,
        role: input.role
      })
      .returning({ id: adminUsers.id });
    const admin = inserted[0];
    if (!admin) throw new Error("Account non creato");
    await tx.insert(auditLogs).values({
      actorAdminId: admin.id,
      actorType: "cli",
      action: "admin.created",
      targetType: "admin_user",
      targetId: admin.id,
      metadata: { role: input.role }
    });
    return admin;
  });
}

export async function resetAdminPassword(input: {
  email: string;
  password: string;
  resetRecovery: boolean;
}) {
  const secrets = authSecrets();
  const recovery = input.resetRecovery
    ? createRecoveryCodes(secrets.recoveryPepper)
    : undefined;
  const passwordHash = await hashAdminPassword(input.password);
  return getDatabase().transaction(async (tx) => {
    const rows = await tx
      .update(adminUsers)
      .set({
        passwordHash,
        sessionVersion: sql`${adminUsers.sessionVersion} + 1`,
        recoveryCodeHashes: recovery?.recoveryCodeHashes,
        updatedAt: new Date()
      })
      .where(
        eq(adminUsers.emailHash, hashEmail(input.email, secrets.hmacPepper))
      )
      .returning({ id: adminUsers.id });
    if (!rows[0]) throw new Error("Account non trovato");
    await tx.insert(auditLogs).values({
      actorAdminId: rows[0].id,
      actorType: "cli",
      action: "admin.password_reset",
      targetType: "admin_user",
      targetId: rows[0].id,
      metadata: { recoveryReset: Boolean(recovery) }
    });
    return { id: rows[0].id, recoveryCodes: recovery?.recoveryCodes };
  });
}

export async function listAdminAccounts() {
  const secrets = authSecrets();
  const rows = await getDatabase().select().from(adminUsers);
  return rows.map((row) => ({
    id: row.id,
    email: decryptSecret(row.emailEncrypted, secrets.encryptionKey),
    role: row.role,
    active: row.disabledAt === null,
    totp: row.totpEnabled
  }));
}
