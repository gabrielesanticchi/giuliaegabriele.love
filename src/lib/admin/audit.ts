import "server-only";

const SENSITIVE_KEY =
  /password|passcode|secret|token|recovery|totp|iban|bank|swift|bic|account|email|phone|address|guestdetails|encrypted|cipher|credential/i;

export function redactAuditMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditMetadata);
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEY.test(key))
      .map(([key, nested]) => [key, redactAuditMetadata(nested)])
  );
}
