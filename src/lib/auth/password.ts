import "server-only";

import { argon2id, hash, verify } from "argon2";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;

function assertStrongPassword(password: string): void {
  if (
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    throw new TypeError("La password deve avere almeno 8 caratteri");
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
