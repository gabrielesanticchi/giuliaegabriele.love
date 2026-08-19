import "server-only";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} non configurato`);
  return value;
}

export function authSecrets() {
  return {
    hmacPepper: required("AUTH_HMAC_PEPPER"),
    encryptionKey: required("AUTH_ENCRYPTION_KEY"),
    recoveryPepper: required("AUTH_RECOVERY_PEPPER")
  };
}

export function isTotpRequired(): boolean {
  return process.env.NODE_ENV === "production";
}
