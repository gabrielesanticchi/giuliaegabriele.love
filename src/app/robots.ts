import type { MetadataRoute } from "next";

/**
 * The site launches `noindex, nofollow` (per the approved design), so crawling
 * is disallowed entirely for now. Admin and API are disallowed unconditionally.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }]
  };
}
