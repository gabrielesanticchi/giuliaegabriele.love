import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileResponse = {
  success?: boolean;
  hostname?: string;
};

export type TurnstileDecision = { success: boolean };

export class TurnstileUnavailableError extends Error {
  constructor() {
    super("Turnstile non disponibile");
    this.name = "TurnstileUnavailableError";
  }
}

export async function verifyTurnstileToken(input: {
  token: string;
  remoteIp?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<TurnstileDecision> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const isDevelopmentDemo =
    process.env.NODE_ENV === "development" &&
    process.env.WEDDING_DEMO_MODE === "true";

  if (!secret) {
    if (isDevelopmentDemo) return { success: true };
    throw new TurnstileUnavailableError();
  }

  const expectedHostname = process.env.TURNSTILE_EXPECTED_HOSTNAME?.trim();
  if (process.env.NODE_ENV === "production" && !expectedHostname) {
    throw new TurnstileUnavailableError();
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? 3_000
  );

  try {
    const form = new URLSearchParams({
      secret,
      response: input.token
    });
    if (input.remoteIp) form.set("remoteip", input.remoteIp);

    const response = await (input.fetchImpl ?? fetch)(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form,
      signal: controller.signal,
      cache: "no-store"
    });
    if (!response.ok) throw new TurnstileUnavailableError();

    const result = (await response.json()) as TurnstileResponse;
    if (!result.success) return { success: false };
    if (expectedHostname && result.hostname !== expectedHostname) {
      return { success: false };
    }
    return { success: true };
  } catch (error) {
    if (error instanceof TurnstileUnavailableError) throw error;
    throw new TurnstileUnavailableError();
  } finally {
    clearTimeout(timeout);
  }
}
