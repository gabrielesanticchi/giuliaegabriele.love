import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const VERSION = 1;

type EncryptedPayload = {
  v: typeof VERSION;
  alg: "A256GCM";
  iv: string;
  ciphertext: string;
  tag: string;
};

function decodeKey(keyBase64: string): Buffer {
  const isCanonicalBase64 =
    /^[A-Za-z0-9+/]+={0,2}$/.test(keyBase64) && keyBase64.length % 4 === 0;
  const key = Buffer.from(keyBase64, "base64");

  if (!isCanonicalBase64 || key.length !== 32) {
    throw new TypeError("La chiave di cifratura deve contenere 32 byte");
  }

  return key;
}

export function encryptSecret(plaintext: string, keyBase64: string): string {
  const key = decodeKey(keyBase64);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);
  const payload: EncryptedPayload = {
    v: VERSION,
    alg: "A256GCM",
    iv: iv.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url")
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decryptSecret(
  payloadBase64: string,
  keyBase64: string
): string {
  const key = decodeKey(keyBase64);

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf8")
    );

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("v" in parsed) ||
      parsed.v !== VERSION ||
      !("alg" in parsed) ||
      parsed.alg !== "A256GCM" ||
      !("iv" in parsed) ||
      typeof parsed.iv !== "string" ||
      !("ciphertext" in parsed) ||
      typeof parsed.ciphertext !== "string" ||
      !("tag" in parsed) ||
      typeof parsed.tag !== "string"
    ) {
      throw new Error("Payload non valido");
    }

    const iv = Buffer.from(parsed.iv, "base64url");
    const tag = Buffer.from(parsed.tag, "base64url");
    if (iv.length !== IV_BYTES || tag.length !== 16) {
      throw new Error("Payload non valido");
    }

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(Buffer.from(parsed.ciphertext, "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    throw new Error("Impossibile decifrare il segreto");
  }
}
