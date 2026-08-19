import type { MetadataRoute } from "next";

function siteBase(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://giuliaegabriele.love"
  );
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteBase();
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 }
  ];
}
