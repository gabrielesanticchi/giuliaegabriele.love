/**
 * Secrets and configuration that MUST be present for a safe production boot.
 * Missing any of these means the app cannot encrypt data, authenticate admins,
 * bind guest tokens or reach the database, so production fails closed rather
 * than degrading to an insecure or demo state.
 */
export const REQUIRED_PRODUCTION_ENV = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_HMAC_PEPPER",
  "AUTH_ENCRYPTION_KEY",
  "AUTH_RECOVERY_PEPPER",
  "DATA_ENCRYPTION_KEY",
  "GUEST_TOKEN_SECRET",
  "REQUEST_FINGERPRINT_SECRET",
  "NEXT_PUBLIC_SITE_URL"
] as const;

export type RequiredProductionEnv = (typeof REQUIRED_PRODUCTION_ENV)[number];

/**
 * Validates a copy of the environment. Blank values count as missing. Throws a
 * single error naming every missing variable so a misconfigured deploy is
 * obvious at boot instead of failing later at first use.
 */
export function assertProductionEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): void {
  const missing = REQUIRED_PRODUCTION_ENV.filter(
    (name) => !env[name] || env[name]!.trim().length === 0
  );
  if (missing.length > 0) {
    throw new Error(
      `Configurazione di produzione incompleta: ${missing.join(", ")}`
    );
  }
}
