import "server-only";

import { randomBytes } from "node:crypto";

import { generateSecret, generateURI, verify } from "otplib";

import { decryptSecret, encryptSecret } from "@/lib/security/crypto";
import { hashToken, verifyTokenHash } from "@/lib/security/hashing";

const RECOVERY_CODE_COUNT = 8;

function recoveryCode(): string {
  const encoded = randomBytes(9).toString("base64url").toUpperCase();
  return `${encoded.slice(0, 6)}-${encoded.slice(6, 12)}`;
}

export function createRecoveryCodes(recoveryPepper: string) {
  const recoveryCodes = Array.from(
    { length: RECOVERY_CODE_COUNT },
    recoveryCode
  );
  return {
    recoveryCodes,
    recoveryCodeHashes: recoveryCodes.map((code) =>
      hashToken(code, recoveryPepper)
    )
  };
}

export function createTotpEnrollment(input: {
  email: string;
  encryptionKey: string;
  recoveryPepper: string;
}) {
  const secret = generateSecret({ length: 20 });
  const recovery = createRecoveryCodes(input.recoveryPepper);
  return {
    secret,
    secretEncrypted: encryptSecret(secret, input.encryptionKey),
    uri: generateURI({
      issuer: "Giulia e Gabriele",
      label: input.email.trim().toLowerCase(),
      secret
    }),
    ...recovery
  };
}

export async function verifyTotpCode(input: {
  code: string;
  secretEncrypted: string;
  encryptionKey: string;
  epoch?: number;
}): Promise<boolean> {
  if (!/^\d{6}$/.test(input.code)) return false;
  try {
    const result = await verify({
      secret: decryptSecret(input.secretEncrypted, input.encryptionKey),
      token: input.code,
      epoch: input.epoch,
      epochTolerance: 30
    });
    return result.valid;
  } catch {
    return false;
  }
}

export function verifyRecoveryCode(input: {
  code: string;
  recoveryCodeHashes: string[];
  recoveryPepper: string;
}): { valid: boolean; remainingHashes: number; hashes?: string[] } {
  const normalized = input.code.trim().toUpperCase();
  const index = input.recoveryCodeHashes.findIndex((digest) =>
    verifyTokenHash(normalized, digest, input.recoveryPepper)
  );
  if (index < 0) {
    return { valid: false, remainingHashes: input.recoveryCodeHashes.length };
  }
  const hashes = input.recoveryCodeHashes.filter(
    (_, hashIndex) => hashIndex !== index
  );
  return { valid: true, remainingHashes: hashes.length, hashes };
}
