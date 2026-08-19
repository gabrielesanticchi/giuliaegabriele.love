import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "@/lib/security/crypto";
import {
  hashEmail,
  hashFingerprint,
  hashToken,
  verifyTokenHash
} from "@/lib/security/hashing";
import { getRateLimitDecision } from "@/lib/security/rate-limit";

describe("AES-256-GCM secret encryption", () => {
  const key = randomBytes(32).toString("base64");

  it("decrypts only the plaintext encrypted with the same key", () => {
    const encrypted = encryptSecret("IBAN DI TEST", key);

    expect(encrypted).not.toContain("IBAN DI TEST");
    expect(decryptSecret(encrypted, key)).toBe("IBAN DI TEST");
  });

  it("uses a fresh IV for every payload", () => {
    expect(encryptSecret("stesso segreto", key)).not.toBe(
      encryptSecret("stesso segreto", key)
    );
  });

  it("rejects a tampered authentication tag", () => {
    const encrypted = encryptSecret("dato sensibile", key);
    const payload = JSON.parse(
      Buffer.from(encrypted, "base64url").toString("utf8")
    ) as { tag: string };
    payload.tag = `${payload.tag.startsWith("A") ? "B" : "A"}${payload.tag.slice(1)}`;
    const tampered = Buffer.from(JSON.stringify(payload)).toString("base64url");

    expect(() => decryptSecret(tampered, key)).toThrow(
      "Impossibile decifrare il segreto"
    );
  });

  it("rejects a different key and malformed key lengths", () => {
    const encrypted = encryptSecret("dato sensibile", key);

    expect(() =>
      decryptSecret(encrypted, randomBytes(32).toString("base64"))
    ).toThrow("Impossibile decifrare il segreto");
    expect(() => encryptSecret("dato sensibile", "bm9uLTMtYnl0ZXM=")).toThrow(
      "La chiave di cifratura deve contenere 32 byte"
    );
  });
});

describe("one-way personal identifiers", () => {
  const pepper = "pepper-di-test-con-alta-entropia";

  it("normalizes email before producing an indexed HMAC", () => {
    expect(hashEmail("  Ospite@Example.COM ", pepper)).toBe(
      hashEmail("ospite@example.com", pepper)
    );
    expect(hashEmail("ospite@example.com", pepper)).not.toContain("ospite");
  });

  it("separates fingerprint and token hash namespaces", () => {
    expect(hashFingerprint("identico", pepper)).not.toBe(
      hashToken("identico", pepper)
    );
  });

  it("compares token hashes without accepting a modified token", () => {
    const digest = hashToken("token-personale", pepper);

    expect(verifyTokenHash("token-personale", digest, pepper)).toBe(true);
    expect(verifyTokenHash("token-modificato", digest, pepper)).toBe(false);
  });
});

describe("rate limit decisions", () => {
  it("allows requests through the configured limit", () => {
    expect(
      getRateLimitDecision({
        count: 3,
        limit: 3,
        now: new Date("2026-08-19T10:00:00.000Z"),
        expiresAt: new Date("2026-08-19T10:01:00.000Z")
      })
    ).toEqual({ allowed: true, remaining: 0, retryAfterSeconds: 0 });
  });

  it("blocks the first request beyond the limit with a rounded-up retry", () => {
    expect(
      getRateLimitDecision({
        count: 4,
        limit: 3,
        now: new Date("2026-08-19T10:00:00.100Z"),
        expiresAt: new Date("2026-08-19T10:00:01.001Z")
      })
    ).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 1 });
  });
});
