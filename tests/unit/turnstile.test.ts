import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TurnstileUnavailableError,
  verifyTurnstileToken
} from "@/lib/turnstile";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("verifyTurnstileToken", () => {
  it("fallisce chiuso in production quando il secret manca", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.TURNSTILE_SECRET_KEY;

    await expect(
      verifyTurnstileToken({ token: "token", remoteIp: "203.0.113.7" })
    ).rejects.toBeInstanceOf(TurnstileUnavailableError);
  });

  it("simula il successo soltanto in development demo esplicito", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.WEDDING_DEMO_MODE = "true";
    delete process.env.TURNSTILE_SECRET_KEY;

    await expect(
      verifyTurnstileToken({ token: "demo", remoteIp: "203.0.113.7" })
    ).resolves.toEqual({ success: true });
  });

  it("rifiuta una verifica valida per un hostname diverso", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.TURNSTILE_SECRET_KEY = "secret";
    process.env.TURNSTILE_EXPECTED_HOSTNAME = "giuliaegabriele.love";
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, hostname: "attacker.example" }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

    await expect(
      verifyTurnstileToken({
        token: "token",
        remoteIp: "203.0.113.7",
        fetchImpl
      })
    ).resolves.toEqual({ success: false });
  });
});
