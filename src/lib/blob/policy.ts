/**
 * Upload allowlist for admin media. Kept intentionally small and free of any
 * active/executable type: SVG is never accepted because it can carry script,
 * and unknown types are rejected by default (fail closed).
 */
export const ALLOWED_MEDIA_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4"
] as const;

export type AllowedMediaContentType =
  (typeof ALLOWED_MEDIA_CONTENT_TYPES)[number];

/** 100 MB — comfortably covers wedding photos and short clips. */
export const MAX_MEDIA_UPLOAD_BYTES = 100 * 1024 * 1024;

export function isAllowedMediaContentType(
  value: string
): value is AllowedMediaContentType {
  return (ALLOWED_MEDIA_CONTENT_TYPES as readonly string[]).includes(value);
}

export function assertMediaUploadAllowed(input: {
  contentType: string;
  sizeBytes: number;
}): void {
  if (!isAllowedMediaContentType(input.contentType)) {
    throw new Error("Tipo di file non consentito");
  }
  if (
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes <= 0 ||
    input.sizeBytes > MAX_MEDIA_UPLOAD_BYTES
  ) {
    throw new Error("Dimensione del file non consentita");
  }
}
