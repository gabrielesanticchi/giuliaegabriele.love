import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

type HashNamespace = "email" | "fingerprint" | "token";

function hmac(value: string, pepper: string, namespace: HashNamespace): string {
  if (!pepper) throw new TypeError("Il pepper HMAC è obbligatorio");
  return createHmac("sha256", pepper)
    .update(`${namespace}\0${value}`, "utf8")
    .digest("hex");
}

export function hashEmail(email: string, pepper: string): string {
  return hmac(email.trim().toLowerCase(), pepper, "email");
}

export function hashFingerprint(fingerprint: string, pepper: string): string {
  return hmac(fingerprint, pepper, "fingerprint");
}

export function hashToken(token: string, pepper: string): string {
  return hmac(token, pepper, "token");
}

export function verifyTokenHash(
  token: string,
  expectedHash: string,
  pepper: string
): boolean {
  const actual = Buffer.from(hashToken(token, pepper), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
