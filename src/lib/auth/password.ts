import "server-only";

import { argon2id, hash, verify } from "argon2";

const MIN_PASSWORD_LENGTH = 16;

function assertStrongPassword(password: string): void {
  const hasEnoughVariety = new Set(password).size >= 8;
  if (
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > 256 ||
    !hasEnoughVariety
  ) {
    throw new TypeError("Password non conforme ai requisiti di sicurezza");
  }
}

export async function hashAdminPassword(password: string): Promise<string> {
  assertStrongPassword(password);
  return hash(password, {
    type: argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1
  });
}

export async function verifyAdminPassword(
  password: string,
  digest: string
): Promise<boolean> {
  if (!password || !digest) return false;
  try {
    return await verify(digest, password);
  } catch {
    return false;
  }
}
