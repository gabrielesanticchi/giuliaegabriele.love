import "server-only";

import { isIP } from "node:net";

export type ClientIdentity = {
  fingerprintMaterial: string;
  remoteIp?: string;
};

export type ClientIdentityPolicy = {
  production: boolean;
  trustedProxyHeader?: string;
};

export class ClientIdentityUnavailableError extends Error {
  constructor() {
    super("Identità client non verificabile");
    this.name = "ClientIdentityUnavailableError";
  }
}

function firstValidIp(value: string | null): string | undefined {
  const candidate = value?.split(",")[0]?.trim();
  return candidate && isIP(candidate) !== 0 ? candidate : undefined;
}

export function resolveClientIdentity(
  request: Request,
  policy: ClientIdentityPolicy
): ClientIdentity {
  const trustedHeader = policy.trustedProxyHeader?.trim().toLowerCase();
  if (trustedHeader && /^[a-z0-9-]+$/.test(trustedHeader)) {
    const remoteIp = firstValidIp(request.headers.get(trustedHeader));
    if (remoteIp) return { fingerprintMaterial: `ip:${remoteIp}`, remoteIp };
  }

  if (policy.production) throw new ClientIdentityUnavailableError();

  // Fallback ammesso solo fuori produzione per sviluppo locale e test.
  const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? "";
  const language = request.headers.get("accept-language")?.slice(0, 256) ?? "";
  const encoding = request.headers.get("accept-encoding")?.slice(0, 128) ?? "";
  return {
    fingerprintMaterial: `fallback\0${userAgent}\0${language}\0${encoding}`
  };
}
