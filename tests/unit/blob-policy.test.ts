import { describe, expect, it } from "vitest";

import {
  ALLOWED_MEDIA_CONTENT_TYPES,
  MAX_MEDIA_UPLOAD_BYTES,
  assertMediaUploadAllowed,
  isAllowedMediaContentType
} from "@/lib/blob/policy";

describe("media upload policy", () => {
  it("allows the curated image and video types", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "video/mp4"]) {
      expect(isAllowedMediaContentType(type)).toBe(true);
    }
    expect(ALLOWED_MEDIA_CONTENT_TYPES).toContain("image/webp");
  });

  it("never trusts SVG or other active/unknown content types", () => {
    for (const type of [
      "image/svg+xml",
      "text/html",
      "application/xml",
      "image/gif",
      ""
    ]) {
      expect(isAllowedMediaContentType(type)).toBe(false);
    }
  });

  it("accepts a well-formed upload within the size limit", () => {
    expect(() =>
      assertMediaUploadAllowed({
        contentType: "image/jpeg",
        sizeBytes: 1_000_000
      })
    ).not.toThrow();
  });

  it("rejects a disallowed content type", () => {
    expect(() =>
      assertMediaUploadAllowed({
        contentType: "image/svg+xml",
        sizeBytes: 1000
      })
    ).toThrow(/tipo/i);
  });

  it("rejects an oversized or non-positive upload", () => {
    expect(() =>
      assertMediaUploadAllowed({
        contentType: "image/png",
        sizeBytes: MAX_MEDIA_UPLOAD_BYTES + 1
      })
    ).toThrow(/dimensione/i);
    expect(() =>
      assertMediaUploadAllowed({ contentType: "image/png", sizeBytes: 0 })
    ).toThrow(/dimensione/i);
  });
});
