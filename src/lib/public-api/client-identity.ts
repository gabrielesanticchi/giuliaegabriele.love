import "server-only";

import { isIP } from "node:net";

export type ClientIdentity = {
  fingerprintMaterial: string;
  remoteIp?: string;
};

function firstValidIp(value: string | null): string | undefined {
  const candidate = value?.split(",")[0]?.trim();
  return candidate && isIP(candidate) !== 0 ? candidate : undefined;
}

export function resolveClientIdentity(
  request: Request,
  trustVercelProxy: boolean
): ClientIdentity {
  if (trustVercelProxy) {
    const remoteIp = firstValidIp(
      request.headers.get("x-vercel-forwarded-for")
    );
    if (remoteIp) return { fingerprintMaterial: `ip:${remoteIp}`, remoteIp };
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? "";
  const language = request.headers.get("accept-language")?.slice(0, 256) ?? "";
  const encoding = request.headers.get("accept-encoding")?.slice(0, 128) ?? "";
  return {
    fingerprintMaterial: `fallback\0${userAgent}\0${language}\0${encoding}`
  };
}
