export function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Safe source for rendered media: an absolute `https` URL (Vercel Blob) or a
 * root-relative local path. Anything else (protocol-relative, `javascript:`,
 * `data:`, bare strings) is rejected so it never reaches an `<img>`/`next/image`.
 */
export function isSafeMediaUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  return isSafeExternalUrl(value);
}
